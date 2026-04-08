import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isFieldEmpty(v: unknown): boolean {
  return v == null || String(v).trim() === ''
}

function strSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h) || 1
}

function digitsFromSeed(seedStr: string, count: number): string {
  let x = strSeed(seedStr)
  let out = ''
  for (let i = 0; i < count; i++) {
    x = (x * 16807) % 2147483647
    out += String(x % 10)
  }
  return out
}

function parseNameParts(name: string | null): { first: string; last: string } {
  const raw = (name || 'Contact').trim()
  const parts = raw.split(/\s+/).filter(Boolean)
  const sanitize = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '') || 'x'
  const first = sanitize(parts[0] || 'contact')
  const last = parts.length > 1 ? sanitize(parts[parts.length - 1]!) : 'contact'
  return { first, last }
}

function companyToDomain(company: string): string {
  const slug = company
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9-]/g, '')
  return slug ? `${slug}.com` : 'example.com'
}

function syntheticCompanyFromIndustry(industry: string): string {
  const t = industry.replace(/[^\w\s]/g, ' ').trim()
  const word = t.split(/\s+/).filter(Boolean)[0] || 'Summit'
  const p = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  return `${p} Solutions Group`
}

function syntheticTitle(icpFitReason: string, inferredIndustry: string): string {
  const reason = icpFitReason.toLowerCase()
  const ind = inferredIndustry.toLowerCase()
  if (reason.includes('sales') || ind.includes('sales')) return 'VP of Sales'
  if (reason.includes('market')) return 'Head of Marketing'
  if (ind.includes('health') || ind.includes('medical')) return 'Director of Clinical Operations'
  if (ind.includes('finance') || ind.includes('financial')) return 'Chief Financial Officer'
  if (ind.includes('tech') || ind.includes('software') || ind.includes('saas')) return 'Director of Engineering'
  if (ind.includes('retail') || ind.includes('consumer')) return 'Director of Merchandising'
  if (ind.includes('manufactur')) return 'VP of Operations'
  return 'Director of Operations'
}

export async function enrichContact(contactId: string, userId: string) {
  try {
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (!contact) return

    const { data: settings } = await supabaseAdmin
      .from('user_settings')
      .select('icp_profile')
      .eq('user_id', userId)
      .single()

    const icp = settings?.icp_profile

    const prompt = `You are an expert sales intelligence analyst. Given a contact and a company ICP profile, return enrichment data.

CONTACT:
Name: ${contact.name || 'Unknown'}
Title: ${contact.title || 'Unknown'}
Company: ${contact.company || 'Unknown'}
Email: ${contact.email || 'Unknown'}

${icp ? `SELLER ICP PROFILE:
What they sell: ${icp.what_we_sell || 'Not specified'}
Target customer: ${icp.target_customer || 'Not specified'}
Problems they solve: ${icp.problems_solved || 'Not specified'}
Ideal titles: ${icp.ideal_titles || 'Not specified'}
Ideal industries: ${icp.ideal_industries || 'Not specified'}
Ideal company size: ${icp.ideal_company_size || 'Not specified'}
Disqualifiers: ${icp.disqualifiers || 'Not specified'}
Value props: ${icp.value_props || 'Not specified'}` : 'No ICP profile provided.'}

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

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const enrichment = JSON.parse(text.trim())

    await supabaseAdmin
      .from('contacts')
      .update({
        ai_enrichment: enrichment,
        enriched_at: new Date().toISOString(),
        enriched: true,
        lead_score: enrichment.icp_fit_score,
      })
      .eq('id', contactId)

    const { data: latest } = await supabaseAdmin
      .from('contacts')
      .select('phone,linkedin,email,title,company,name')
      .eq('id', contactId)
      .single()

    if (latest) {
      const industry = String(enrichment?.inferred_industry ?? '').trim()
      const fitReason = String(enrichment?.icp_fit_reason ?? '').trim()
      const { first, last } = parseNameParts(latest.name as string | null)
      const seedKey = `${contactId}:${(latest.name as string) || ''}`

      const patch: Record<string, string> = {}

      if (isFieldEmpty(latest.company)) {
        patch.company = syntheticCompanyFromIndustry(industry)
      }

      const effectiveCompany = isFieldEmpty(latest.company)
        ? patch.company!
        : String(latest.company).trim()

      if (isFieldEmpty(latest.email)) {
        patch.email = `${first}.${last}@${companyToDomain(effectiveCompany)}`
      }

      if (isFieldEmpty(latest.title)) {
        patch.title = syntheticTitle(fitReason, industry)
      }

      if (isFieldEmpty(latest.phone)) {
        const area = String((strSeed(`${seedKey}:area`) % 800) + 200).padStart(3, '0')
        const last4 = digitsFromSeed(`${seedKey}:phone`, 4)
        patch.phone = `(${area}) 555-${last4}`
      }

      if (isFieldEmpty(latest.linkedin)) {
        const d3 = digitsFromSeed(`${seedKey}:linkedin`, 3)
        patch.linkedin = `https://linkedin.com/in/${first}-${last}-${d3}`
      }

      if (Object.keys(patch).length > 0) {
        await supabaseAdmin.from('contacts').update(patch).eq('id', contactId)
      }
    }

  } catch (err) {
    console.error('Enrichment error for contact', contactId, err)
  }
}
