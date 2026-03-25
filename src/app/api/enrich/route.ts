import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { enrichContact } from '@/lib/enrichContact'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type PartialContact = {
  name?: string | null
  title?: string | null
  company?: string | null
  email?: string | null
}

function buildEnrichmentPrompt(contact: {
  name: string
  title: string
  company: string
  email: string
}, icp: Record<string, unknown> | null | undefined) {
  return `You are an expert sales intelligence analyst. Given a contact and a company ICP profile, return enrichment data.

CONTACT:
Name: ${contact.name || 'Unknown'}
Title: ${contact.title || 'Unknown'}
Company: ${contact.company || 'Unknown'}
Email: ${contact.email || 'Unknown'}

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

async function enrichPartialContact(contact: PartialContact, userId: string) {
  const { data: settings } = await supabaseAdmin
    .from('user_settings')
    .select('icp_profile')
    .eq('user_id', userId)
    .single()

  const icp = settings?.icp_profile as Record<string, unknown> | null | undefined

  const prompt = buildEnrichmentPrompt(
    {
      name: contact.name ?? '',
      title: contact.title ?? '',
      company: contact.company ?? '',
      email: contact.email ?? '',
    },
    icp ?? null
  )

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text.trim()) as Record<string, unknown>
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const contactId = body.contactId as string | undefined
    const userId = body.userId as string | undefined
    const contact = body.contact as PartialContact | undefined

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    if (contactId) {
      await enrichContact(contactId, userId)
      const { data: row, error } = await supabaseAdmin
        .from('contacts')
        .select('ai_enrichment')
        .eq('id', contactId)
        .single()
      if (error || !row?.ai_enrichment) {
        return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 })
      }
      return NextResponse.json({ success: true, enrichment: row.ai_enrichment })
    }

    if (contact && typeof contact === 'object') {
      const hasAny =
        (contact.name && String(contact.name).trim()) ||
        (contact.title && String(contact.title).trim()) ||
        (contact.company && String(contact.company).trim()) ||
        (contact.email && String(contact.email).trim())
      if (!hasAny) {
        return NextResponse.json({ error: 'Contact fields required' }, { status: 400 })
      }
      const enrichment = await enrichPartialContact(contact, userId)
      return NextResponse.json({ success: true, enrichment })
    }

    return NextResponse.json({ error: 'Missing contactId or contact' }, { status: 400 })
  } catch (err) {
    console.error('Enrich route error:', err)
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 })
  }
}
