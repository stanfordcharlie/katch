import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  const baseUrl = process.env.HUBSPOT_REDIRECT_URI?.replace("/api/hubspot/callback", "");

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&error=hubspot_denied`);
  }

  try {
    const tokenRes = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.HUBSPOT_CLIENT_ID!,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
        redirect_uri: process.env.HUBSPOT_REDIRECT_URI!,
        code,
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokenRes.ok) {
      throw new Error(tokens.message || "Token exchange failed");
    }

    const infoRes = await fetch(
      "https://api.hubapi.com/oauth/v1/access-tokens/" + tokens.access_token
    );
    const info = await infoRes.json();
    const hubId = info.hub_id?.toString();

    const stateParam = req.nextUrl.searchParams.get("state");
    let userId: string | null = null;

    if (stateParam) {
      try {
        const decoded = JSON.parse(Buffer.from(decodeURIComponent(stateParam), "base64").toString());
        userId = decoded.userId || null;
      } catch (e) {
        userId = null;
      }
    }

    if (!userId) {
      console.error("Could not identify user from state param");
      return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&error=hubspot_failed`);
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabaseAdmin.from("hubspot_tokens").upsert(
      {
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        hub_id: hubId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&connected=hubspot`);
  } catch (err) {
    console.error("HubSpot OAuth error:", err);
    return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&error=hubspot_failed`);
  }
}
