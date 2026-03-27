import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type CsvContact = {
  name: string
  email: string
  company: string
  title: string
  phone: string
  linkedin: string
}

function parseCsv(csvText: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i]
    const next = csvText[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cell.trim())
      cell = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i += 1
      row.push(cell.trim())
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }

  if (cell.length || row.length) {
    row.push(cell.trim())
    if (row.some((c) => c !== '')) rows.push(row)
  }

  return rows
}

function parseJsonFromModel(text: string): Record<string, string | null> | null {
  const trimmed = text.trim()
  const withoutFence = trimmed
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim()
  try {
    return JSON.parse(withoutFence) as Record<string, string | null>
  } catch {
    const start = withoutFence.indexOf('{')
    const end = withoutFence.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(withoutFence.slice(start, end + 1)) as Record<string, string | null>
      } catch {
        return null
      }
    }
    return null
  }
}

async function mapColumnsWithClaude(headers: string[], sampleRows: string[][]) {
  const sample = sampleRows.map((r) => {
    const out: Record<string, string> = {}
    headers.forEach((h, i) => {
      out[h] = r[i] ?? ''
    })
    return out
  })

  const prompt = `Here are the headers and sample rows from a CSV lead list. Map each column to one of: name, email, company, title, phone, linkedin, or ignore. Return only a JSON object like { name: 'Full Name', email: 'Email Address', company: 'Company', title: 'Job Title', phone: 'Phone', linkedin: 'LinkedIn URL' } where each value is the exact original header name, or null if not found. Headers and sample: ${JSON.stringify({ headers, sample }, null, 2)}`

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const parsed = parseJsonFromModel(text)
  if (!parsed) return null
  return {
    name: parsed.name ?? null,
    email: parsed.email ?? null,
    company: parsed.company ?? null,
    title: parsed.title ?? null,
    phone: parsed.phone ?? null,
    linkedin: parsed.linkedin ?? null,
  }
}

function extractContacts(rows: string[][], headers: string[], mapping: Record<string, string | null>): CsvContact[] {
  const indexFor = (mapped: string | null) => (mapped ? headers.indexOf(mapped) : -1)
  const idx = {
    name: indexFor(mapping.name),
    email: indexFor(mapping.email),
    company: indexFor(mapping.company),
    title: indexFor(mapping.title),
    phone: indexFor(mapping.phone),
    linkedin: indexFor(mapping.linkedin),
  }

  return rows
    .map((r) => ({
      name: idx.name >= 0 ? r[idx.name] ?? '' : '',
      email: idx.email >= 0 ? r[idx.email] ?? '' : '',
      company: idx.company >= 0 ? r[idx.company] ?? '' : '',
      title: idx.title >= 0 ? r[idx.title] ?? '' : '',
      phone: idx.phone >= 0 ? r[idx.phone] ?? '' : '',
      linkedin: idx.linkedin >= 0 ? r[idx.linkedin] ?? '' : '',
    }))
    .filter((c) => (c.name || '').trim() !== '' || (c.email || '').trim() !== '')
}

function buildEnrichmentPrompt(contact: CsvContact, icp: Record<string, unknown> | null | undefined) {
  return `You are an expert sales intelligence analyst. Given a contact and a company ICP profile, return enrichment data.

CONTACT:
Name: ${contact.name || 'Unknown'}
Title: ${contact.title || 'Unknown'}
Company: ${contact.company || 'Unknown'}
Email: ${contact.email || 'Unknown'}
Phone: ${contact.phone || 'Unknown'}
LinkedIn: ${contact.linkedin || 'Unknown'}

${icp ? `SELLER ICP PROFILE:
What they sell: ${(icp as { what_we_sell?: string }).what_we_sell || 'Not specified'}
Target customer: ${(icp as { target_customer?: string }).target_customer || 'Not specified'}
Problems they solve: ${(icp as { problems_solved?: string }).problems_solved || 'Not specified'}
Ideal titles: ${(icp as { ideal_titles?: string }).ideal_titles || 'Not specified'}
Ideal industries: ${(icp as { ideal_industries?: string }).ideal_industries || 'Not specified'}
Ideal company size: ${(icp as { ideal_company_size?: string }).ideal_company_size || 'Not specified'}
Disqualifiers: ${(icp as { disqualifiers?: string }).disqualifiers || 'Not specified'}
Value props: ${(icp as { value_props?: string }).value_props || 'Not specified'}` : 'No ICP profile provided.'}

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
}`
}

async function enrichOneContact(contact: CsvContact, icp: Record<string, unknown> | null | undefined) {
  const prompt = buildEnrichmentPrompt(contact, icp)
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const enrichment = parseJsonFromModel(text) ?? {}
  const ai = enrichment as Record<string, unknown>
  return {
    ...contact,
    ai_enrichment: ai,
    suggested_lead_score: Number(ai.suggested_lead_score ?? 5) || 5,
    icp_fit_score: Number(ai.icp_fit_score ?? 0) || 0,
    icp_fit_reason: typeof ai.icp_fit_reason === 'string' ? ai.icp_fit_reason : '',
    summary: typeof ai.summary === 'string' ? ai.summary : '',
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const csvText = body.csvText as string | undefined
    const userId = body.userId as string | undefined
    const eventId = body.eventId as string | undefined

    if (!csvText || !userId || !eventId) {
      return NextResponse.json({ error: 'Missing csvText, userId, or eventId' }, { status: 400 })
    }

    const rows = parseCsv(csvText)
    if (rows.length < 2) {
      return NextResponse.json({ error: 'Could not parse this CSV — make sure it has name or email columns.' }, { status: 400 })
    }

    const headers = rows[0]
    const sampleRows = rows.slice(1, 4)
    const mapping = await mapColumnsWithClaude(headers, sampleRows)
    if (!mapping) {
      return NextResponse.json({ error: 'Could not parse this CSV — make sure it has name or email columns.' }, { status: 400 })
    }
    if (!mapping.name && !mapping.email) {
      return NextResponse.json({ error: 'Could not parse this CSV — make sure it has name or email columns.' }, { status: 400 })
    }

    const contacts = extractContacts(rows.slice(1), headers, mapping)
    if (!contacts.length) {
      return NextResponse.json({ error: 'Could not parse this CSV — make sure it has name or email columns.' }, { status: 400 })
    }

    const { data: settings } = await supabaseAdmin
      .from('user_settings')
      .select('icp_profile')
      .eq('user_id', userId)
      .single()
    const icpProfile = (settings?.icp_profile as Record<string, unknown> | null | undefined) ?? null

    const enrichedContacts: Array<Record<string, unknown>> = []
    for (let i = 0; i < contacts.length; i += 5) {
      const batch = contacts.slice(i, i + 5)
      const enrichedBatch = await Promise.all(batch.map((c) => enrichOneContact(c, icpProfile)))
      enrichedContacts.push(...enrichedBatch)
      if (i + 5 < contacts.length) {
        await new Promise((r) => setTimeout(r, 500))
      }
    }

    return NextResponse.json({ contacts: enrichedContacts })
  } catch (err) {
    console.error('Enrich list route error:', err)
    return NextResponse.json({ error: 'Enrichment failed — try again.' }, { status: 500 })
  }
}
