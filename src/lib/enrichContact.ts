import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
      model: 'claude-opus-4-5',
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
      })
      .eq('id', contactId)

  } catch (err) {
    console.error('Enrichment error for contact', contactId, err)
  }
}
