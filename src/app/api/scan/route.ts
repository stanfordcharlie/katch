import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

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
              text: `You are extracting contact information from a business card or conference badge.

Return ONLY a valid JSON object with these exact fields:
{
  "name": "",
  "title": "",
  "company": "",
  "email": "",
  "phone": "",
  "linkedin": ""
}

Only extract information that is explicitly visible on the card. If a field such as email, phone, linkedin, title, or company is not present on the card, return it as null or an empty string. Never guess, infer, or fabricate values for missing fields. Do not replace missing values with placeholders like "N/A" or "Unknown".

Return nothing but the JSON object.`,
            },
          ],
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const contact = JSON.parse(clean);

    return NextResponse.json({ contact });
  } catch (err) {
    console.error("Scan error:", err);
    return NextResponse.json({ error: "Failed to scan image" }, { status: 500 });
  }
}
