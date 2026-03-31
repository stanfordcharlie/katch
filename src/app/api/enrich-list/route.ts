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
          const chunks: CsvContact[][] = []
          for (let i = 0; i < contactsToProcess.length; i += 10) {
            chunks.push(contactsToProcess.slice(i, i + 10))
          }

          const apiKey = process.env.ANTHROPIC_API_KEY
          if (!apiKey) {
            throw new Error('Missing ANTHROPIC_API_KEY')
          }

          for (let bi = 0; bi < chunks.length; bi++) {
            const chunk = chunks[bi]
            let responseText = '[]'

            const pushFallbackForChunk = async () => {
              for (const contact of chunk) {
                const fallback = {
                  ...contact,
                  icp_fit_score: 5,
                  icp_fit_reason: 'Could not score',
                  suggested_lead_score: 5,
                  summary: '',
                  talking_points: [] as unknown[],
                  red_flags: [] as unknown[],
                  ai_enrichment: null,
                }
                results.push(fallback)
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: 'progress',
                      current: results.length,
                      total: contactsToProcess.length,
                      contact: fallback,
                    }) + '\n'
                  )
                )
                await new Promise((r) => setTimeout(r, 20))
              }
            }

            try {
              const batchPrompt = `You are a B2B sales intelligence assistant. Score each of the following contacts against this ICP profile and return a JSON array.

ICP Profile:
${JSON.stringify(icpProfile, null, 2)}

Contacts to score:
${JSON.stringify(
                chunk.map((c, i) => ({
                  index: i,
                  name: c.name,
                  title: c.title,
                  company: c.company,
                  email: c.email,
                })),
                null,
                2
              )}

For each contact return an object with these exact fields:
- index: the contact's index number from above
- icp_fit_score: integer 1-10
- icp_fit_reason: one sentence explaining the score
- suggested_lead_score: integer 1-10
- summary: 2-3 sentence summary of why this person is or isn't a good fit
- talking_points: array of 2-3 specific talking points for this person
- red_flags: array of 0-2 red flags, empty array if none

Return ONLY a valid JSON array with no markdown, no backticks, no explanation. Just the raw JSON array.`

              const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                  model: 'claude-sonnet-4-5',
                  max_tokens: 4000,
                  messages: [{ role: 'user', content: batchPrompt }],
                }),
              })

              const data = (await response.json()) as {
                content?: Array<{ type?: string; text?: string }>
              }
              if (!response.ok) {
                console.error('Batch Anthropic HTTP error:', response.status, data)
                throw new Error('Anthropic request failed')
              }
              responseText = data.content?.[0]?.text || '[]'

              const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
              const scores = JSON.parse(cleaned) as Array<Record<string, unknown>>
              if (!Array.isArray(scores)) {
                throw new Error('Expected JSON array from Claude')
              }

              const byIndex = new Map<number, Record<string, unknown>>()
              for (const score of scores) {
                const idx = typeof score.index === 'number' ? score.index : NaN
                if (!Number.isNaN(idx)) byIndex.set(idx, score)
              }

              for (let i = 0; i < chunk.length; i++) {
                const contact = chunk[i]
                const score = byIndex.get(i)
                let enriched: Record<string, unknown>
                if (score) {
                  const talking_points = Array.isArray(score.talking_points) ? score.talking_points : []
                  const red_flags = Array.isArray(score.red_flags) ? score.red_flags : []
                  enriched = {
                    ...contact,
                    icp_fit_score: Number(score.icp_fit_score ?? 5) || 5,
                    icp_fit_reason:
                      typeof score.icp_fit_reason === 'string' ? score.icp_fit_reason : '',
                    suggested_lead_score: Number(score.suggested_lead_score ?? 5) || 5,
                    summary: typeof score.summary === 'string' ? score.summary : '',
                    talking_points,
                    red_flags,
                    ai_enrichment: {
                      icp_fit_score: score.icp_fit_score,
                      icp_fit_reason: score.icp_fit_reason,
                      suggested_lead_score: score.suggested_lead_score,
                      summary: score.summary,
                      talking_points: score.talking_points,
                      red_flags: score.red_flags,
                    },
                  }
                } else {
                  enriched = {
                    ...contact,
                    icp_fit_score: 5,
                    icp_fit_reason: 'Could not score',
                    suggested_lead_score: 5,
                    summary: '',
                    talking_points: [],
                    red_flags: [],
                    ai_enrichment: null,
                  }
                }
                results.push(enriched)
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: 'progress',
                      current: results.length,
                      total: contactsToProcess.length,
                      contact: enriched,
                    }) + '\n'
                  )
                )
                await new Promise((r) => setTimeout(r, 20))
              }
            } catch (e) {
              console.error('Batch parse failed:', e, 'Raw response:', responseText)
              await pushFallbackForChunk()
            }

            if (bi < chunks.length - 1) {
              await new Promise((r) => setTimeout(r, 300))
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
