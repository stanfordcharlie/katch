import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enrichContact } from "@/lib/enrichContact";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { contactId, userId } = await req.json();

    if (!contactId || !userId) {
      return NextResponse.json(
        { error: "contactId and userId are required" },
        { status: 400 }
      );
    }

    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    if ((contact as { user_id?: string }).user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await enrichContact(contactId, userId);
    const { data: updated } = await supabaseAdmin
      .from("contacts")
      .select("ai_enrichment")
      .eq("id", contactId)
      .single();

    return NextResponse.json({ success: true, enrichment: updated?.ai_enrichment ?? null });
  } catch (err) {
    console.error("Enrichment error:", err);
    return NextResponse.json({ error: "Enrichment failed" }, { status: 500 });
  }
}
