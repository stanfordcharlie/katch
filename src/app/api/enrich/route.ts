import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { contactId, userId } = await req.json();

    if (!contactId || !userId) {
      return NextResponse.json(
        { error: "contactId and userId are required" },
        { status: 400 }
      );
    }

    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    if ((contact as { user_id?: string }).user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: settings } = await supabaseAdmin
      .from("user_settings")
      .select("icp_profile")
      .eq("user_id", userId)
      .single();

    const icp = settings?.icp_profile as Record<string, string> | null | undefined;

    const prompt = `You are an expert sales intelligence analyst. Given a contact and a company's ICP profile, enrich the contact with insights.

CONTACT:
Name: ${contact.name || "Unknown"}
Title: ${contact.title || "Unknown"}
Company: ${contact.company || "Unknown"}
Email: ${contact.email || "Unknown"}

${icp ? `SELLER'S ICP PROFILE:
What they sell: ${icp.what_we_sell || "Not specified"}
Target customer: ${icp.target_customer || "Not specified"}
Problems they solve: ${icp.problems_solved || "Not specified"}
Ideal titles: ${icp.ideal_titles || "Not specified"}
Ideal industries: ${icp.ideal_industries || "Not specified"}
Ideal company size: ${icp.ideal_company_size || "Not specified"}
Disqualifiers: ${icp.disqualifiers || "Not specified"}
Value props: ${icp.value_props || "Not specified"}` : "No ICP profile provided."}

Return a JSON object with exactly these fields:
{
  "inferred_industry": "string - the most likely industry for this company",
  "inferred_company_size": "string - estimated company size range e.g. 50-200 employees",
  "icp_fit_score": number from 1-10 where 10 is perfect ICP fit,
  "icp_fit_reason": "string - one sentence explaining the ICP fit score",
  "suggested_lead_score": number from 1-10 based on title seniority and ICP fit,
  "talking_points": ["string", "string", "string"] - 3 specific talking points for this contact based on their role and the seller's value props,
  "red_flags": ["string"] - array of 0-2 potential concerns or disqualifiers, empty array if none,
  "summary": "string - 2 sentence summary of who this person is and why they matter"
}

Return only valid JSON. No explanation, no markdown backticks.`;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const enrichment = JSON.parse(text.trim()) as Record<string, unknown>;

    await supabaseAdmin
      .from("contacts")
      .update({
        ai_enrichment: enrichment,
        enriched_at: new Date().toISOString(),
        enriched: true,
      })
      .eq("id", contactId);

    return NextResponse.json({ success: true, enrichment });
  } catch (err) {
    console.error("Enrichment error:", err);
    return NextResponse.json({ error: "Enrichment failed" }, { status: 500 });
  }
}
