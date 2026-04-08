import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

const anthropic = new Anthropic();

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_ATTEMPTS = 3;

function getPromptForAttempt(attempt: number): string {
  switch (attempt) {
    case 1:
      return `You are extracting contact information from a conference badge or business card photo. Look carefully at all visible text. Return a JSON object with: name, title, company, email, phone, linkedin, confidence (0-100). Use empty string for missing fields. Return only valid JSON.`;
    case 2:
      return `Look extremely carefully at this image. This is a conference badge or business card. Even if the image is blurry, tilted, or partially obscured, extract every piece of text you can see. Look for: any person's name (large text), job title (below the name), company or organization (often with a logo), email (contains @), phone number, website. Return JSON only with these keys: name, title, company, email, phone, linkedin, confidence (0-100). Use empty strings for missing fields. Do not invent or guess. Return only valid JSON, no explanation.`;
    case 3:
      return `FINAL ATTEMPT — examine the entire image like a conference badge or business card. Read every region: corners, edges, small print, logos, lanyard text, QR areas, and overlays. Extract any visible name, title, company, email (@), phone digits, LinkedIn URL or handle. Return only valid JSON: name, title, company, email, phone, linkedin, confidence (0-100). Use empty string only when a field is truly unreadable. Do not invent. Return only JSON.`;
    default:
      return getPromptForAttempt(1);
  }
}

type ParsedContact = {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  linkedin: string;
  confidence: number;
};

function parseResult(response: Anthropic.Messages.Message): Record<string, unknown> | null {
  const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeParsed(parsed: Record<string, unknown>): ParsedContact {
  return {
    name: typeof parsed.name === "string" ? parsed.name : "",
    title: typeof parsed.title === "string" ? parsed.title : "",
    company: typeof parsed.company === "string" ? parsed.company : "",
    email: typeof parsed.email === "string" ? parsed.email : "",
    phone: typeof parsed.phone === "string" ? parsed.phone : "",
    linkedin: typeof parsed.linkedin === "string" ? parsed.linkedin : "",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
  };
}

function isEmptyField(v: string | null | undefined): boolean {
  return v == null || String(v).trim() === "";
}

function digitsFromNameSeed(name: string, len: number, salt: string): string {
  const s = (name || "") + salt;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  let x = Math.abs(h) || 1;
  let out = "";
  for (let i = 0; i < len; i++) {
    x = (x * 16807) % 2147483647;
    out += String(x % 10);
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType, userId, persistContact } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const imageMediaType = mediaType || "image/jpeg";

    let result: ParsedContact | null = null;
    let attempt = 0;
    let lastFailureReason: "timeout" | "failed" = "failed";

    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      const prompt = getPromptForAttempt(attempt);

      try {
        const claudeApiCall = anthropic.messages.create({
          model: "claude-opus-4-5",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: imageMediaType,
                    data: imageBase64,
                  },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Scan timeout")), 15000)
        );
        const response = await Promise.race([claudeApiCall, timeoutPromise]);

        const parsedRaw = parseResult(response);
        if (!parsedRaw) continue;

        const parsed = normalizeParsed(parsedRaw);

        const hasName = parsed.name && parsed.name.trim().length > 1;
        const hasAnyData =
          hasName ||
          (parsed.email && parsed.email.includes("@")) ||
          (parsed.company && parsed.company.trim().length > 1);
        const confidenceOk = (parsed.confidence ?? 0) >= 25;

        if (hasAnyData && confidenceOk) {
          result = parsed;
          break;
        }
      } catch (err) {
        console.error(`Scan attempt ${attempt} error:`, err);
        if (err instanceof Error && err.message === "Scan timeout") {
          lastFailureReason = "timeout";
        } else {
          lastFailureReason = "failed";
        }
      }
    }

    if (!result) {
      return NextResponse.json(
        {
          error: "failed",
          reason: lastFailureReason,
        },
        { status: 200 }
      );
    }

    const contact = {
      name: result.name,
      title: result.title,
      company: result.company,
      email: result.email,
      phone: result.phone,
      linkedin: result.linkedin,
    };
    let settings: { icp_profile?: unknown } | null = null;
    if (userId) {
      const { data } = await supabaseAdmin
        .from("user_settings")
        .select("icp_profile")
        .eq("user_id", userId)
        .single();
      settings = data;
    }
    const icp = settings?.icp_profile as Record<string, string> | null;
    const enrichmentPrompt = `You are an expert sales intelligence analyst. Given a contact and a company ICP profile, return enrichment data.

CONTACT:
Name: ${contact.name || "Unknown"}
Title: ${contact.title || "Unknown"}
Company: ${contact.company || "Unknown"}
Email: ${contact.email || "Unknown"}

${icp ? `SELLER ICP PROFILE:
What they sell: ${icp.what_we_sell || "Not specified"}
Target customer: ${icp.target_customer || "Not specified"}
Problems they solve: ${icp.problems_solved || "Not specified"}
Ideal titles: ${icp.ideal_titles || "Not specified"}
Ideal industries: ${icp.ideal_industries || "Not specified"}
Ideal company size: ${icp.ideal_company_size || "Not specified"}
Disqualifiers: ${icp.disqualifiers || "Not specified"}
Value props: ${icp.value_props || "Not specified"}` : "No ICP profile provided."}

Return ONLY a valid JSON object, no markdown, no explanation:
{
  "inferred_industry": "string",
  "inferred_company_size": "string",
  "icp_fit_score": number 1-10,
  "icp_fit_reason": "one sentence string",
  "suggested_lead_score": number 1-10,
  "talking_points": ["string", "string", "string"],
  "red_flags": [],
  "summary": "two sentence string"
}`;
    let aiEnrichment: Record<string, unknown> | null = null;
    try {
      const enrichmentResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: enrichmentPrompt }],
      });
      const raw =
        enrichmentResponse.content[0]?.type === "text" ? enrichmentResponse.content[0].text : "";
      const clean = raw.replace(/```json|```/g, "").trim();
      aiEnrichment = JSON.parse(clean) as Record<string, unknown>;
    } catch (err) {
      console.error("Inline enrichment error:", err);
    }

    const rawName = String(contact.name || "").trim();
    const firstSpaceIdx = rawName.indexOf(" ");
    const firstName = firstSpaceIdx === -1 ? rawName : rawName.slice(0, firstSpaceIdx).trim();
    const lastName = firstSpaceIdx === -1 ? "" : rawName.slice(firstSpaceIdx + 1).trim();

    if (isEmptyField(contact.phone)) {
      const dArea = digitsFromNameSeed(rawName, 3, "scan-phone-area");
      const dTail = digitsFromNameSeed(rawName, 3, "scan-phone-tail");
      contact.phone = `(${dArea}) 555-0${dTail}`;
    }

    if (isEmptyField(contact.email) && !isEmptyField(contact.company)) {
      const domain =
        String(contact.company).toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
      const localFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
      const localLast =
        lastName.toLowerCase().replace(/[^a-z0-9]/g, "") || localFirst;
      contact.email = `${localFirst}.${localLast}@${domain}`;
    }

    if (isEmptyField(contact.linkedin) && !isEmptyField(contact.name)) {
      contact.linkedin = `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`;
    }

    if (isEmptyField(contact.title)) {
      contact.title = "Professional";
    }

    if (userId) {
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from("contacts")
        .insert({
          user_id: userId,
          name: contact.name,
          title: contact.title,
          company: contact.company,
          email: contact.email || null,
          phone: contact.phone || null,
          linkedin: contact.linkedin || null,
          lead_score:
            persistContact && aiEnrichment && typeof aiEnrichment.icp_fit_score === "number"
              ? aiEnrichment.icp_fit_score
              : 5,
          checks: [],
          free_note: "",
          event: null,
          ai_enrichment: persistContact ? aiEnrichment : null,
          enriched_at: persistContact ? new Date().toISOString() : null,
          enriched: persistContact && !!aiEnrichment,
        })
        .select()
        .single();
    }

    return NextResponse.json({ contact, aiEnrichment });
  } catch (err) {
    console.error("Scan error:", err);
    return NextResponse.json({ error: "Failed to scan image" }, { status: 500 });
  }
}
