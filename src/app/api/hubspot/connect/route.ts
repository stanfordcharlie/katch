import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
  const userId = req.nextUrl.searchParams.get("userId");

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Missing HubSpot env vars" }, { status: 500 });
  }

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const scopes = [
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.schemas.contacts.read",
  ].join(" ");

  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

  const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(authUrl);
}
