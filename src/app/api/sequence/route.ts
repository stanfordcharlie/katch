import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: Request) {
  const { tone = "professional", extra_instructions, ...contact } = await req.json();

  const client = new Anthropic();

  const toneBlock = `Write the emails in a ${tone} tone.
- Professional: formal, concise, polished
- Casual: relaxed, conversational, like texting a colleague
- Friendly: warm, personable, upbeat
- Bold: direct, confident, no fluff
- Funny: light humor, memorable, still appropriate for business`;

  const extraLine =
    extra_instructions && String(extra_instructions).trim()
      ? `\nAdditional instructions from the rep: ${String(extra_instructions).trim()}`
      : "";

  const prompt = `You are a sales follow-up expert. Generate a 3-email sequence for a sales rep who met this contact at a conference.

Contact details:
- Name: ${contact.name}
- Title: ${contact.title}
- Company: ${contact.company}
- Email: ${contact.email}
- Met at: ${contact.event || "a conference"}
- Lead score: ${contact.lead_score}/10
- Buying signals: ${Array.isArray(contact.checks) ? contact.checks.join(", ") : "none"}
- Notes from conversation: ${contact.free_note || "none"}

${toneBlock}${extraLine}

Write 3 emails. Format as JSON only, no markdown:
{
  "emails": [
    { "day": "Day 1-2", "subject": "...", "body": "..." },
    { "day": "Day 5-7", "subject": "...", "body": "..." },
    { "day": "Day 12-14", "subject": "...", "body": "..." }
  ]
}`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const clean = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);

  return Response.json(parsed);
}
