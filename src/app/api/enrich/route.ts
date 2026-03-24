import { NextRequest, NextResponse } from 'next/server'
import { enrichContact } from '@/lib/enrichContact'

export async function POST(req: NextRequest) {
  try {
    const { contactId, userId } = await req.json()
    if (!contactId || !userId) {
      return NextResponse.json({ error: 'Missing contactId or userId' }, { status: 400 })
    }
    await enrichContact(contactId, userId)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Enrich route error:', err)
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 })
  }
}
