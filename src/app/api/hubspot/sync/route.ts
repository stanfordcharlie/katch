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

function hubspotErrorMessage(responseText: string, data: Record<string, unknown>): string {
  const msg = typeof data.message === "string" ? data.message : "";
  const errs = data.errors;
  if (Array.isArray(errs) && errs.length > 0) {
    const parts = errs.map((e) => {
      if (e && typeof e === "object" && "message" in e) {
        return String((e as { message: unknown }).message);
      }
      return JSON.stringify(e);
    });
    const combined = [msg, ...parts].filter(Boolean).join(" — ");
    return combined || responseText || "Unknown HubSpot error";
  }
  return msg || (typeof data.status === "string" ? data.status : "") || responseText || "Unknown HubSpot error";
}

async function fetchHubSpotOwnerId(accessToken: string, userEmail: string): Promise<string | null> {
  const url = `https://api.hubapi.com/crm/v3/owners?email=${encodeURIComponent(userEmail)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const body = (await res.json()) as { results?: { id?: string }[] };
  const id = body.results?.[0]?.id;
  return id != null ? String(id) : null;
}

function shouldCreateKatchNote(contact: {
  lead_score?: unknown;
  ai_enrichment?: unknown;
  checks?: unknown;
}): boolean {
  if (contact.ai_enrichment != null) return true;
  if (contact.lead_score != null && contact.lead_score !== "") return true;
  if (Array.isArray(contact.checks) && contact.checks.length > 0) return true;
  return false;
}

function getAiEnrichment(contact: Record<string, unknown>): Record<string, unknown> | null {
  const raw = contact.ai_enrichment;
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

async function buildKatchHubSpotNote(contact: Record<string, unknown>): Promise<string> {
  let eventName = "—";
  if (contact.event != null && String(contact.event).trim() !== "") {
    const { data: eventData } = await supabaseAdmin
      .from("events")
      .select("name")
      .eq("id", contact.event)
      .single();
    eventName = eventData?.name || "Unknown event";
  }

  const ae = getAiEnrichment(contact);

  let html = "<strong>KATCH CONTACT SUMMARY</strong><br><hr>";
  html += `<br><strong>Lead Score:</strong> ${contact.lead_score ?? "N/A"}/10`;

  if (ae?.icp_fit_score != null) {
    html += `<br><strong>ICP Fit Score:</strong> ${ae.icp_fit_score}/10`;
  }
  if (ae?.icp_fit_reason) {
    html += `<br><strong>ICP Fit Reason:</strong> ${String(ae.icp_fit_reason)}`;
  }
  if (ae?.summary) {
    html += `<br><br><strong>SUMMARY</strong><br>${String(ae.summary)}`;
  }
  if (Array.isArray(ae?.talking_points) && ae.talking_points.length) {
    html += `<br><br><strong>TALKING POINTS</strong><ul>`;
    ae.talking_points.forEach((tp: unknown) => {
      html += `<li>${String(tp)}</li>`;
    });
    html += "</ul>";
  }
  if (Array.isArray(ae?.red_flags) && ae.red_flags.length) {
    html += `<br><strong>RED FLAGS</strong><ul>`;
    ae.red_flags.forEach((rf: unknown) => {
      html += `<li>${String(rf)}</li>`;
    });
    html += "</ul>";
  }
  const checks = contact.checks;
  if (Array.isArray(checks) && checks.length > 0) {
    html += `<br><strong>CONVERSATION SIGNALS</strong><ul>`;
    checks.forEach((s: unknown) => {
      html += `<li>${String(s)}</li>`;
    });
    html += "</ul>";
  }
  html += `<br><strong>Event:</strong> ${eventName}`;
  html += `<br><strong>Enriched:</strong> ${contact.enriched ? "Yes" : "No"}`;
  html += `<br><strong>Scanned with Katch on</strong> ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  return html;
}

async function attachKatchNoteToContact(
  accessToken: string,
  hubspotContactId: string,
  noteText: string
): Promise<void> {
  const res = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      properties: {
        hs_note_body: noteText,
        hs_timestamp: new Date().toISOString(),
      },
      associations: [
        {
          to: { id: hubspotContactId },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 202,
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("HubSpot note create failed:", res.status, t);
  }
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

    const { data: contacts } = await supabaseAdmin
      .from("contacts")
      .select("*")
      .in("id", contactIds);

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ error: "no_contacts" }, { status: 400 });
    }

    let hubspotOwnerId: string | null = null;
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = authData.user?.email?.trim();
    if (userEmail) {
      try {
        hubspotOwnerId = await fetchHubSpotOwnerId(accessToken, userEmail);
      } catch {
        hubspotOwnerId = null;
      }
    }

    const results = await Promise.all(
      contacts.map(async (contact) => {
        const nameParts = (contact.name ?? "").split(" ");
        const firstname = nameParts[0] ?? "";
        const lastname = nameParts.slice(1).join(" ") ?? "";

        let companyNorm = contact.company ?? "";
        if (companyNorm) {
          let company = String(companyNorm)
            .replace(/^https?:\/\//i, "")
            .replace(/^www\./i, "")
            .replace(/\.[a-z]{2,}(\/.*)?$/i, "")
            .trim();
          company = company
            .split(/[\s-]+/)
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          companyNorm = company;
        }

        const properties: Record<string, string> = {
          firstname,
          lastname,
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          jobtitle: contact.title ?? "",
          company: companyNorm,
          katch_source: contact.source ?? "",
          katch_status: contact.status ?? "",
        };
        if (hubspotOwnerId) properties.hubspot_owner_id = hubspotOwnerId;

        const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ properties }),
        });

        const responseText = await response.clone().text();
        if (!response.ok) {
          console.error("HubSpot response status:", response.status);
          console.error("HubSpot response body:", responseText);
        }

        let data: Record<string, unknown> = {};
        try {
          if (responseText) data = JSON.parse(responseText) as Record<string, unknown>;
        } catch {
          data = {};
        }

        if (response.ok) {
          await supabaseAdmin
            .from("contacts")
            .update({
              synced_to_hubspot: true,
              hubspot_synced_at: new Date().toISOString(),
            })
            .eq("id", contact.id);

          const hubspotContactId = data.id != null ? String(data.id) : "";
          if (hubspotContactId && shouldCreateKatchNote(contact)) {
            try {
              const noteText = await buildKatchHubSpotNote(contact as Record<string, unknown>);
              await attachKatchNoteToContact(accessToken, hubspotContactId, noteText);
            } catch (noteErr) {
              console.error("HubSpot Katch note error:", noteErr);
            }
          }

          return { contactId: contact.id, success: true, hubspotId: data.id as string | undefined };
        }

        const errMsg = hubspotErrorMessage(responseText, data);
        return {
          contactId: contact.id,
          success: false,
          error: errMsg,
        };
      })
    );

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const firstFailure = results.find((r) => !r.success);

    return NextResponse.json({
      succeeded,
      failed,
      results,
      message: firstFailure?.error,
    });
  } catch (err) {
    console.error("HubSpot sync error:", err);
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
}
