import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data: tokenRow } = await supabaseAdmin
    .from("hubspot_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenRow) return null;

  if (new Date(tokenRow.expires_at) > new Date()) {
    return tokenRow.access_token;
  }

  const refreshRes = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      refresh_token: tokenRow.refresh_token,
    }),
  });

  const refreshed = await refreshRes.json();
  if (!refreshRes.ok) return null;

  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabaseAdmin
    .from("hubspot_tokens")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return refreshed.access_token;
}

const KATCH_HUBSPOT_PROPERTY_DEFS: { name: string; label: string }[] = [
  { name: "katch_lead_score", label: "Katch Lead Score" },
  { name: "katch_icp_fit_score", label: "Katch ICP Fit Score" },
  { name: "katch_icp_fit_reason", label: "Katch ICP Fit Reason" },
  { name: "katch_summary", label: "Katch Summary" },
  { name: "katch_talking_points", label: "Katch Talking Points" },
  { name: "katch_red_flags", label: "Katch Red Flags" },
  { name: "katch_signals", label: "Katch Signals" },
  { name: "katch_event", label: "Katch Event" },
  { name: "katch_enriched", label: "Katch Enriched" },
];

async function createKatchPropertiesIfNeeded(accessToken: string): Promise<void> {
  for (const { name, label } of KATCH_HUBSPOT_PROPERTY_DEFS) {
    const res = await fetch("https://api.hubapi.com/crm/v3/properties/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name,
        label,
        type: "string",
        fieldType: "text",
        groupName: "contactinformation",
      }),
    });
    if (res.status === 409) continue;
    if (!res.ok) {
      const errBody = await res.text();
      console.error("HubSpot create property failed:", name, res.status, errBody);
    }
  }
}

function appendKatchProperties(properties: Record<string, string>, contact: Record<string, unknown>) {
  const rawAe = contact["ai_enrichment"];
  const en =
    rawAe != null && typeof rawAe === "object" && !Array.isArray(rawAe)
      ? (rawAe as Record<string, unknown>)
      : undefined;

  properties.katch_lead_score =
    contact["lead_score"] != null ? String(contact["lead_score"]) : "";

  properties.katch_icp_fit_score =
    en?.icp_fit_score != null ? String(en.icp_fit_score) : "";

  properties.katch_icp_fit_reason = String(en?.icp_fit_reason ?? "");

  let summary = String(en?.summary ?? "");
  if (summary.length > 500) summary = summary.substring(0, 500);
  properties.katch_summary = summary;

  let talkingPoints = Array.isArray(en?.talking_points)
    ? (en.talking_points as unknown[]).map((x) => String(x)).join(" | ")
    : "";
  if (talkingPoints.length > 500) talkingPoints = talkingPoints.substring(0, 500);
  properties.katch_talking_points = talkingPoints;

  properties.katch_red_flags = Array.isArray(en?.red_flags)
    ? (en.red_flags as unknown[]).map((x) => String(x)).join(" | ")
    : "";

  const checks = contact["checks"];
  properties.katch_signals = Array.isArray(checks)
    ? (checks as unknown[]).map((x) => String(x)).join(" | ")
    : "";

  properties.katch_event = String(contact["event"] ?? "");

  properties.katch_enriched = contact["enriched"] === true ? "true" : "false";
}

export async function POST(req: NextRequest) {
  try {
    const { contactIds, userId } = await req.json();

    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json(
        { error: "not_connected", message: "HubSpot not connected" },
        { status: 401 }
      );
    }

    try {
      await createKatchPropertiesIfNeeded(accessToken);
    } catch (e) {
      console.error("Property setup failed, continuing sync:", e);
    }

    const { data: contacts } = await supabaseAdmin
      .from("contacts")
      .select("*")
      .in("id", contactIds);

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ error: "no_contacts" }, { status: 400 });
    }

    const { data: tokenRow } = await supabaseAdmin
      .from("hubspot_tokens")
      .select("hub_id")
      .eq("user_id", userId)
      .single();

    const ownersRes = await fetch("https://api.hubapi.com/crm/v3/owners?limit=1", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const ownersData = await ownersRes.json();
    const ownerId = ownersData.results?.[0]?.id;

    const results = await Promise.all(
      contacts.map(async (contact) => {
        const properties: Record<string, string> = {};
        if (contact.name) {
          const parts = contact.name.trim().split(" ");
          properties.firstname = parts[0] || "";
          properties.lastname = parts.slice(1).join(" ") || "";
        }
        if (contact.email) properties.email = contact.email;
        if (contact.phone) properties.phone = contact.phone;
        if (contact.company) {
          let company = contact.company
            .replace(/^https?:\/\//i, "")
            .replace(/^www\./i, "")
            .replace(/\.[a-z]{2,}(\/.*)?$/i, "")
            .trim();
          company = company
            .split(/[\s-]+/)
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          properties.company = company;
        }
        if (contact.title) properties.jobtitle = contact.title;
        if (contact.linkedin) properties.linkedinbio = contact.linkedin;
        if (contact.lead_score)
          properties.hs_lead_status = contact.lead_score >= 7 ? "IN_PROGRESS" : "OPEN";

        if (ownerId) properties.hubspot_owner_id = String(ownerId);

        appendKatchProperties(properties, contact as Record<string, unknown>);

        const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ properties }),
        });

        const rawBody = await res.text();
        let data: { id?: string; message?: string; status?: string; [key: string]: unknown } = {};
        try {
          if (rawBody) data = JSON.parse(rawBody) as typeof data;
        } catch {
          data = { raw: rawBody };
        }
        if (res.ok) {
          await supabaseAdmin
            .from("contacts")
            .update({
              synced_to_hubspot: true,
              hubspot_synced_at: new Date().toISOString(),
            })
            .eq("id", contact.id);
          return { contactId: contact.id, success: true, hubspotId: data.id };
        }
        console.error(
          "HubSpot contact create failed:",
          contact.name,
          "status:",
          res.status,
          "full HubSpot API response body:",
          rawBody
        );
        return {
          contactId: contact.id,
          success: false,
          error: data.message || data.status || "Unknown HubSpot error",
        };
      })
    );

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({ succeeded, failed, results });
  } catch (err) {
    console.error("HubSpot sync error:", err);
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
}
