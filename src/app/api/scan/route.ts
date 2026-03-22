import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const VISION_PROMPT = `You are extracting contact information from a photo of a conference badge or business card.

Look carefully at ALL text visible in the image — including small print, logos, lanyards, name tags, printed cards, or any text overlay. Even if the image is blurry or partially obscured, extract whatever you can read.

Return a JSON object with these fields:
{
  name: string,        // Full name — look for large text, first+last name format
  title: string,       // Job title — look for words like Manager, Director, CEO, VP, Engineer, etc.
  company: string,     // Company or organization name — often near a logo
  email: string,       // Email address — look for @ symbol
  phone: string,       // Phone number — any format
  linkedin: string,    // LinkedIn URL or username if visible
  confidence: number   // Your confidence score 0-100 that this is a real contact with real data
}

If you cannot read a field, use an empty string. Do not invent or guess data.
If the image does not appear to contain a badge or business card at all, set confidence to 0.
Return only valid JSON, no explanation.`;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: VISION_PROMPT,
            },
          ],
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as Record<string, unknown>;

    const result = {
      name: typeof parsed.name === "string" ? parsed.name : "",
      title: typeof parsed.title === "string" ? parsed.title : "",
      company: typeof parsed.company === "string" ? parsed.company : "",
      email: typeof parsed.email === "string" ? parsed.email : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      linkedin: typeof parsed.linkedin === "string" ? parsed.linkedin : "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 100,
    };

    const hasName = result.name && result.name.trim().length > 1;
    const hasAnyData =
      hasName ||
      (result.email && result.email.includes("@")) ||
      (result.company && result.company.trim().length > 1);
    const confidenceOk = (result.confidence ?? 100) >= 25;

    if (!hasAnyData || !confidenceOk) {
      return NextResponse.json(
        {
          success: false,
          error: "scan_failed",
          message: "Could not extract contact information from this image. Please try a clearer photo.",
        },
        { status: 422 }
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

    return NextResponse.json({ contact });
  } catch (err) {
    console.error("Scan error:", err);
    return NextResponse.json({ error: "Failed to scan image" }, { status: 500 });
  }
}
