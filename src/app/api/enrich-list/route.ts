import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

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

const knownMappings: Record<string, string> = {
  'first name': 'first_name',
  firstname: 'first_name',
  first: 'first_name',
  'last name': 'last_name',
  lastname: 'last_name',
  last: 'last_name',
  'full name': 'name',
  name: 'name',
  attendee: 'name',
  delegate: 'name',
  contact: 'name',
  'attendee name': 'name',
  'member name': 'name',
  participant: 'name',
  registrant: 'name',
  'badge name': 'name',
  'display name': 'name',
  email: 'email',
  'email address': 'email',
  'e-mail': 'email',
  'work email': 'email',
  'business email': 'email',
  'corp email': 'email',
  company: 'company',
  organization: 'company',
  organisation: 'company',
  employer: 'company',
  'company name': 'company',
  institution: 'company',
  agency: 'company',
  org: 'company',
  dept: 'company',
  department: 'company',
  affiliation: 'company',
  workplace: 'company',
  title: 'title',
  'job title': 'title',
  position: 'title',
  role: 'title',
  job: 'title',
  designation: 'title',
  'job function': 'title',
  level: 'title',
  seniority: 'title',
  phone: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  cell: 'phone',
  telephone: 'phone',
  'cell phone': 'phone',
  'mobile phone': 'phone',
  direct: 'phone',
  'work phone': 'phone',
  linkedin: 'linkedin',
  'linkedin url': 'linkedin',
  'linkedin profile': 'linkedin',
  suffix: 'ignore',
  prefix: 'ignore',
  salutation: 'ignore',
  city: 'ignore',
  state: 'ignore',
  country: 'ignore',
  zip: 'ignore',
  address: 'ignore',
}

const headerKeywords = [
  'name',
  'email',
  'company',
  'title',
  'first',
  'last',
  'phone',
  'organization',
  'position',
  'role',
  'contact',
  'attendee',
  'delegate',
  'employer',
  'institution',
  'linkedin',
  'job',
]

const scoreRow = (row: string[]) =>
  row.reduce((score, cell) => {
    const normalized = cell.toLowerCase().trim().replace(/[^a-z ]/g, '')
    return score + (headerKeywords.some((k) => normalized.includes(k)) ? 1 : 0)
  }, 0)

const mapHeader = (h: string): string => {
  const normalized = h.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '')
  return knownMappings[normalized] || 'ignore'
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

function parseJsonFromText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const withoutFence = trimmed
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim()
  try {
    return JSON.parse(withoutFence) as Record<string, unknown>
  } catch {
    const start = withoutFence.indexOf('{')
    const end = withoutFence.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(withoutFence.slice(start, end + 1)) as Record<string, unknown>
      } catch {
        return null
      }
    }
    return null
  }
}

function buildFieldToIndexLocal(headers: string[]): Record<string, number> {
  const fieldToIndex: Record<string, number> = {}
  for (let i = 0; i < headers.length; i++) {
    const field = mapHeader(headers[i])
    if (field === 'ignore') continue
    if (fieldToIndex[field] === undefined) fieldToIndex[field] = i
  }
  return fieldToIndex
}

function pickHeaderString(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string' && v.trim()) return v
  return null
}

function resolveHeaderIndex(headers: string[], label: string): number {
  const t = label.trim()
  let i = headers.indexOf(t)
  if (i >= 0) return i
  const tl = t.toLowerCase()
  for (let j = 0; j < headers.length; j++) {
    if (headers[j].trim().toLowerCase() === tl) return j
  }
  return -1
}

function buildFieldToIndexFromClaude(headers: string[], parsed: Record<string, unknown>): Record<string, number> {
  const keys = ['name', 'first_name', 'last_name', 'email', 'company', 'title', 'phone', 'linkedin'] as const
  const idx: Record<string, number> = {}
  for (const k of keys) {
    const label = pickHeaderString(parsed[k])
    if (!label) continue
    const j = resolveHeaderIndex(headers, label)
    if (j >= 0) idx[k] = j
  }
  return idx
}

async function mapHeadersWithClaude(headers: string[]): Promise<Record<string, unknown> | null> {
  const prompt =
    'These are column headers from a conference attendee CSV export. Map each header to one of: name, first_name, last_name, email, company, title, phone, linkedin, or ignore. Return only a JSON object where keys are these field names and values are the exact original header strings or null. Headers: ' +
    JSON.stringify(headers)
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  return parseJsonFromText(text)
}

function extractContacts(dataRows: string[][], fieldToIndex: Record<string, number>): CsvContact[] {
  const idx = fieldToIndex
  const nameCol = idx.name
  const fi = idx.first_name
  const li = idx.last_name

  return dataRows
    .map((r) => {
      let name = nameCol !== undefined ? (r[nameCol] ?? '').trim() : ''
      if (!name && fi !== undefined && li !== undefined) {
        name = `${r[fi] ?? ''} ${r[li] ?? ''}`.trim()
      }
      return {
        name,
        email: idx.email !== undefined ? (r[idx.email] ?? '').trim() : '',
        company: idx.company !== undefined ? (r[idx.company] ?? '').trim() : '',
        title: idx.title !== undefined ? (r[idx.title] ?? '').trim() : '',
        phone: idx.phone !== undefined ? (r[idx.phone] ?? '').trim() : '',
        linkedin: idx.linkedin !== undefined ? (r[idx.linkedin] ?? '').trim() : '',
      }
    })
    .filter((c) => !((c.name || '').trim() === '' && (c.email || '').trim() === ''))
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

async function enrichContact(contact: CsvContact, icpProfile: Record<string, unknown> | null | undefined) {
  const prompt = buildEnrichmentPrompt(contact, icpProfile)
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const enrichment = parseJsonFromText(text) ?? {}
  const ai = enrichment as Record<string, unknown>
  const talking_points = Array.isArray(ai.talking_points) ? ai.talking_points : []
  const red_flags = Array.isArray(ai.red_flags) ? ai.red_flags : []
  return {
    ...contact,
    ai_enrichment: ai,
    suggested_lead_score: Number(ai.suggested_lead_score ?? 5) || 5,
    icp_fit_score: Number(ai.icp_fit_score ?? 0) || 0,
    icp_fit_reason: typeof ai.icp_fit_reason === 'string' ? ai.icp_fit_reason : '',
    summary: typeof ai.summary === 'string' ? ai.summary : '',
    talking_points,
    red_flags,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const csvText = body.csvText as string | undefined
    const userId = body.userId as string | undefined

    if (!csvText || !userId) {
      return NextResponse.json({ error: 'Missing csvText or userId' }, { status: 400 })
    }

    const cleaned = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
    const rows = parseCsv(cleaned)
    if (!rows.length) {
      return NextResponse.json(
        {
          error: 'no_valid_rows',
          message: 'Could not find name or email columns in this CSV. Headers found: ',
        },
        { status: 400 }
      )
    }

    let headerRowIndex = 0
    let bestScore = 0
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const score = scoreRow(rows[i])
      if (score > bestScore) {
        bestScore = score
        headerRowIndex = i
      }
    }

    const headers = rows[headerRowIndex]
    const dataRows = rows.slice(headerRowIndex + 1)

    let fieldToIndex = buildFieldToIndexLocal(headers)
    if (Object.keys(fieldToIndex).length < 2) {
      const claudeMap = await mapHeadersWithClaude(headers)
      if (claudeMap) {
        fieldToIndex = buildFieldToIndexFromClaude(headers, claudeMap)
      }
    }

    console.log('enrich-list: detected header row index', headerRowIndex)
    console.log('enrich-list: raw headers', headers)
    console.log('enrich-list: mapped fields', fieldToIndex)

    const validContacts = extractContacts(dataRows, fieldToIndex)
    console.log('enrich-list: valid contacts extracted', validContacts.length)

    if (!validContacts.length) {
      return NextResponse.json(
        {
          error: 'no_valid_rows',
          message: 'Could not find name or email columns in this CSV. Headers found: ' + headers.join(', '),
        },
        { status: 400 }
      )
    }

    const contactsToProcess = validContacts.slice(0, 100)

    const { data: settings } = await supabaseAdmin
      .from('user_settings')
      .select('icp_profile')
      .eq('user_id', userId)
      .maybeSingle()
    const icpProfile = (settings?.icp_profile as Record<string, unknown> | null | undefined) ?? null

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const results: Array<Record<string, unknown>> = []
          for (let i = 0; i < contactsToProcess.length; i++) {
            const contact = contactsToProcess[i]
            let row: Record<string, unknown>
            try {
              const enriched = await enrichContact(contact, icpProfile)
              row = { ...contact, ...enriched }
            } catch (e) {
              console.error('Enrichment failed for:', contact.name, e)
              row = {
                ...contact,
                icp_fit_score: 5,
                icp_fit_reason: 'Could not enrich',
                summary: '',
                suggested_lead_score: 5,
                ai_enrichment: {},
                talking_points: [],
                red_flags: [],
              }
            }
            results.push(row)
            const progressEvent =
              JSON.stringify({
                type: 'progress',
                current: i + 1,
                total: contactsToProcess.length,
                contact: row,
              }) + '\n'
            controller.enqueue(encoder.encode(progressEvent))
            if ((i + 1) % 5 === 0 && i + 1 < contactsToProcess.length) {
              await new Promise((r) => setTimeout(r, 800))
            }
          }
          const doneEvent =
            JSON.stringify({
              type: 'done',
              contacts: results,
              truncated: validContacts.length > contactsToProcess.length,
              totalRows: validContacts.length,
            }) + '\n'
          controller.enqueue(encoder.encode(doneEvent))
        } catch (e) {
          const errorEvent = JSON.stringify({ type: 'error', message: String(e) }) + '\n'
          controller.enqueue(encoder.encode(errorEvent))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Enrich list route error:', error)
    return NextResponse.json({ error: 'server_error', message: String(error) }, { status: 500 })
  }
}
