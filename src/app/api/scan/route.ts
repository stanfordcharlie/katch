import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enrichContact } from "@/lib/enrichContact";

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

    let enrichmentResult: Record<string, unknown> | null = null;

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
          lead_score: 5,
          checks: [],
          free_note: "",
          event: null,
          ai_enrichment: null,
          enriched_at: null,
          enriched: false,
        })
        .select()
        .single();

      if (!insertError && insertedData?.id) {
        await enrichContact(insertedData.id as string, userId as string);
        const { data: enrichedRow } = await supabaseAdmin
          .from("contacts")
          .select("ai_enrichment")
          .eq("id", insertedData.id as string)
          .single();
        enrichmentResult =
          (enrichedRow?.ai_enrichment as Record<string, unknown> | null | undefined) || null;

        if (!persistContact) {
          await supabaseAdmin.from("contacts").delete().eq("id", insertedData.id as string);
        }
      }
    }

    return NextResponse.json({ contact, enrichment: enrichmentResult });
  } catch (err) {
    console.error("Scan error:", err);
    return NextResponse.json({ error: "Failed to scan image" }, { status: 500 });
  }
}
