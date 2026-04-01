import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 300;
export const runtime = "nodejs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type CadenceStep = { day: number; tone: string };

type ContactPayload = {
  id: string;
  name?: string | null;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  event?: string | null;
  lead_score?: number | null;
  leadScore?: number | null;
  checks?: string[] | null;
  free_note?: string | null;
  freeNote?: string | null;
  ai_enrichment?: Record<string, unknown> | null;
};

function toneInstructions(tone: string): string {
  const t = String(tone || "professional").toLowerCase();
  if (t === "friendly") {
    return "Warm, personable, upbeat — like a trusted colleague checking in.";
  }
  if (t === "direct") {
    return "Clear and concise, no fluff; get to the point while staying respectful.";
  }
  return "Formal, polished, appropriate for senior buyers — concise and credible.";
}

function enrichmentSummary(en: Record<string, unknown> | null | undefined): string {
  if (!en || typeof en !== "object") return "none";
  try {
    const parts: string[] = [];
    const tp = en.talking_points;
    if (Array.isArray(tp)) parts.push(`Talking points: ${tp.slice(0, 8).join("; ")}`);
    const sig = en.signals ?? en.buying_signals;
    if (Array.isArray(sig)) parts.push(`Signals: ${sig.slice(0, 8).join("; ")}`);
    const summary = en.summary ?? en.overview;
    if (typeof summary === "string" && summary.trim()) parts.push(`Summary: ${summary.slice(0, 500)}`);
    return parts.length ? parts.join("\n") : JSON.stringify(en).slice(0, 2000);
  } catch {
    return "none";
  }
}

async function generateEmailsForContact(
  contact: ContactPayload,
  cadence: CadenceStep[],
  context?: string | null
): Promise<{ day: number; subject: string; body: string }[]> {
  const checks = Array.isArray(contact.checks) ? contact.checks.join(", ") : "none";
  const notes = contact.free_note ?? contact.freeNote ?? "none";
  const score = contact.lead_score ?? contact.leadScore ?? "n/a";

  const stepsBlock = cadence
    .map(
      (s, i) =>
        `Step ${i + 1}: Send on day ${s.day} of the sequence. Tone: ${s.tone} — ${toneInstructions(s.tone)}`
    )
    .join("\n");

  const ctxLine =
    context && String(context).trim() ? `\nAdditional context from the rep:\n${String(context).trim()}` : "";

  const dayList = cadence.map((s) => s.day).join(", ");
  const jsonExampleLines = cadence
    .map((s) => `    { "day": ${s.day}, "subject": "...", "body": "..." }`)
    .join(",\n");

  const prompt = `You are an expert B2B sales copywriter. Write a complete follow-up email sequence for ONE contact in a single response. Generate ALL ${cadence.length} emails now — one email per cadence step — in one JSON object.

Contact:
- Name: ${contact.name ?? "Unknown"}
- Title: ${contact.title ?? ""}
- Company: ${contact.company ?? ""}
- Email: ${contact.email ?? ""}
- Event / context: ${contact.event ?? "conference"}
- Lead score (1-10): ${score}
- Buying signals / badges: ${checks}
- Rep notes: ${notes}
- AI research / enrichment:
${enrichmentSummary(contact.ai_enrichment ?? null)}
${ctxLine}

Cadence (generate exactly one email per step, in order):
${stepsBlock}

Rules:
- Personalize using name, company, title, and enrichment.
- Each email must use the exact "day" number from its step (${dayList}) and that step's tone.
- Output exactly ${cadence.length} emails in the same order as the cadence steps.
- Subjects: compelling, not spammy, under 80 characters when possible.
- Bodies: plain text, suitable for email, no markdown, sign off professionally.

Return ONLY valid JSON (no markdown fences). Use exactly this structure with your real subject/body text and these day numbers (${dayList}):
{
  "emails": [
${jsonExampleLines}
  ]
}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const clean = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(clean) as { emails?: { day: number; subject: string; body: string }[] };
  const emails = parsed.emails ?? [];
  return emails.map((e) => ({
    day: Number(e.day),
    subject: String(e.subject ?? ""),
    body: String(e.body ?? ""),
  }));
}

/** Legacy: flat contact fields + tone + extra_instructions (no contact key) */
function isLegacyBody(body: Record<string, unknown>): boolean {
  return !Array.isArray(body.contacts) && typeof body.id === "string" && !body.contact;
}

type SingleRequestBody = {
  contact?: ContactPayload;
  contacts?: ContactPayload[];
  cadence?: CadenceStep[];
  context?: string;
  tone?: string;
  extra_instructions?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown> & SingleRequestBody;

    if (isLegacyBody(body)) {
      const tone = (body.tone as string) || "professional";
      const extra = body.extra_instructions as string | undefined;
      const contact = body as unknown as ContactPayload;
      const cadence: CadenceStep[] = [
        { day: 1, tone },
        { day: 5, tone },
        { day: 12, tone },
      ];
      const emails = await generateEmailsForContact(contact, cadence, extra);
      const legacyEmails = emails.map((e, i) => ({
        day: i === 0 ? "Day 1-2" : i === 1 ? "Day 5-7" : "Day 12-14",
        subject: e.subject,
        body: e.body,
      }));
      return Response.json({ emails: legacyEmails });
    }

    const cadence = body.cadence;
    if (!cadence || !Array.isArray(cadence) || cadence.length === 0) {
      return Response.json({ error: "cadence array required" }, { status: 400 });
    }

    let contact: ContactPayload | undefined = body.contact;
    if (!contact && Array.isArray(body.contacts) && body.contacts.length === 1) {
      contact = body.contacts[0];
    }

    if (!contact?.id) {
      return Response.json({ error: "contact object with id required" }, { status: 400 });
    }

    const context = body.context != null ? String(body.context) : "";

    const emails = await generateEmailsForContact(contact, cadence as CadenceStep[], context || undefined);
    return Response.json({
      contactId: contact.id,
      emails,
      results: [{ contactId: contact.id, emails }],
    });
  } catch (e) {
    console.error("/api/sequence error", e);
    return Response.json(
      { error: "Sequence generation failed", contactId: "", emails: [] as { day: number; subject: string; body: string }[] },
      { status: 500 }
    );
  }
}
