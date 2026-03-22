import { supabase } from '@/lib/supabase'

export async function findDuplicateContact(name: string, email: string, userId: string) {
  const { data } = await supabase
    .from('contacts')
    .select('id, name, title, company, email, phone, linkedin, lead_score, checks, free_note, event, image, enriched')
    .eq('user_id', userId)

  if (!data) return null

  const nameLower = name?.toLowerCase().trim()
  const emailLower = email?.toLowerCase().trim()

  return data.find(contact => {
    const existingName = contact.name?.toLowerCase().trim()
    const existingEmail = contact.email?.toLowerCase().trim()

    const emailMatch = emailLower && existingEmail && emailLower === existingEmail
    const nameMatch = nameLower && existingName && (
      existingName === nameLower ||
      existingName.includes(nameLower) ||
      nameLower.includes(existingName)
    )

    return emailMatch || nameMatch
  }) || null
}
