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
        if (contact.company) properties.company = contact.company;
        if (contact.title) properties.jobtitle = contact.title;
        if (contact.linkedin) properties.linkedinbio = contact.linkedin;
        if (contact.lead_score)
          properties.hs_lead_status = contact.lead_score >= 7 ? "IN_PROGRESS" : "OPEN";

        const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ properties }),
        });

        const data = await res.json();
        return { contactId: contact.id, success: res.ok, hubspotId: data.id, error: data.message };
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
