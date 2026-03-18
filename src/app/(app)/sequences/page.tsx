"use client";

import { useState, useEffect, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Avatar, ScoreBadge } from "@/components/katch-ui";

type Contact = any;
type EventRow = { id: string; name: string };

function getContactEvent(contact: Contact): string | null {
  const v = contact.event;
  return v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim();
}

export default function SequencesPage() {
  const searchParams = useSearchParams();
  const contactIdFromUrl = searchParams.get("contactId");
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [seqEmails, setSeqEmails] = useState<{ day: string; subject: string; body: string }[]>([]);
  const [seqLoading, setSeqLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [expandedEventKeys, setExpandedEventKeys] = useState<Set<string>>(new Set());
  const [tone, setTone] = useState("professional");
  const [extraInstructions, setExtraInstructions] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(data.session.user as User);
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      const { data: eventsData } = await supabase
        .from("events")
        .select("id, name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (contactsData) setContacts((contactsData as Contact[]) || []);
      if (eventsData) setEvents((eventsData as EventRow[]) || []);
    };
    fetchData();
  }, [user?.id]);

  const { byEvent, unassigned } = useMemo(() => {
    const byEvent: { eventName: string; eventId?: string; contacts: Contact[] }[] = [];
    const eventNames = new Set(events.map((e) => e.name));
    for (const ev of events) {
      const list = contacts.filter((c) => getContactEvent(c) === ev.name);
      if (list.length > 0) byEvent.push({ eventName: ev.name, eventId: ev.id, contacts: list });
    }
    const unassigned = contacts.filter((c) => getContactEvent(c) === null);
    return { byEvent, unassigned };
  }, [contacts, events]);

  const preselectContact = useMemo(() => {
    if (!contactIdFromUrl || contacts.length === 0) return null;
    return contacts.find((c) => c.id === contactIdFromUrl) || null;
  }, [contactIdFromUrl, contacts]);

  useEffect(() => {
    if (preselectContact && !selectedContact) setSelectedContact(preselectContact);
  }, [preselectContact, selectedContact]);

  const toggleEvent = (key: string) => {
    setExpandedEventKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleGenerateSequence = async (contact: any) => {
    setSeqLoading(true);
    setSeqEmails([]);
    try {
      const res = await fetch("/api/sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contact, tone, extra_instructions: extraInstructions.trim() || undefined }),
      });
      const data = await res.json();
      setSeqEmails(data.emails ?? []);
    } catch (err) {
      console.error("Sequence generation failed:", err);
    } finally {
      setSeqLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const selectContact = (c: Contact) => {
    setSelectedContact(c);
    setSeqEmails([]);
  };

  const backToContacts = () => {
    setSelectedContact(null);
    setSeqEmails([]);
  };

  const score = (c: Contact) => Number(c.lead_score ?? c.leadScore) || 0;

  if (!user) return <div className="min-h-screen bg-[#f0f0ec]" />;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: "@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500;600&display=swap');" }} />
      <div
        className="min-h-screen bg-[#f0f0ec] px-5 py-7"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: "#1a2e1a" }}
      >
        <div className={selectedContact ? "max-w-5xl mx-auto flex gap-8" : "max-w-2xl mx-auto"}>
          <div className={selectedContact ? "flex-1 min-w-0" : "w-full"}>
            <div className="mb-5">
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.03em", color: "#1a2e1a" }}>
                Sequences
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "#6b6560" }}>AI-generated follow-up emails by event</p>
            </div>

            {contacts.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-2xl" style={{ borderColor: "#e5e0db", color: "#6b6560" }}>
                <p className="text-sm mb-1">No contacts yet</p>
                <p className="text-xs">Scan a contact first, then come back here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {byEvent.map(({ eventName, eventId, contacts: list }) => {
                  const key = eventId ?? `ev-${eventName}`;
                  const isOpen = expandedEventKeys.has(key);
                  return (
                    <div
                      key={key}
                      className="rounded-2xl overflow-hidden border"
                      style={{ borderColor: "#e5e0db", backgroundColor: "#fff" }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleEvent(key)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#f0f0ec] transition-colors"
                      >
                        <span className="font-semibold text-sm" style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1a2e1a" }}>
                          {eventName}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: "#c4855a", color: "#c4855a" }}>
                          {list.length}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="border-t" style={{ borderColor: "#e5e0db" }}>
                          {list.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectContact(c)}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                selectedContact?.id === c.id ? "bg-[#f0ebe6]" : "hover:bg-[#f0f0ec]"
                              }`}
                            >
                              <Avatar name={c.name} size="sm" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate" style={{ color: "#1a2e1a" }}>{c.name}</p>
                                <p className="text-xs truncate" style={{ color: "#6b6560" }}>{c.title} · {c.company}</p>
                              </div>
                              <ScoreBadge score={score(c)} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {unassigned.length > 0 && (
                  <div
                    className="rounded-2xl overflow-hidden border"
                    style={{ borderColor: "#e5e0db", backgroundColor: "#fff" }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleEvent("unassigned")}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#f0f0ec] transition-colors"
                    >
                      <span className="font-semibold text-sm" style={{ fontFamily: "'Cormorant Garamond', serif", color: "#1a2e1a" }}>
                        Unassigned
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: "#c4855a", color: "#c4855a" }}>
                        {unassigned.length}
                      </span>
                    </button>
                    {expandedEventKeys.has("unassigned") && (
                      <div className="border-t" style={{ borderColor: "#e5e0db" }}>
                        {unassigned.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectContact(c)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                              selectedContact?.id === c.id ? "bg-[#f0ebe6]" : "hover:bg-[#f0f0ec]"
                            }`}
                          >
                            <Avatar name={c.name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate" style={{ color: "#1a2e1a" }}>{c.name}</p>
                              <p className="text-xs truncate" style={{ color: "#6b6560" }}>{c.title ?? ""} · {c.company ?? ""}</p>
                            </div>
                            <ScoreBadge score={score(c)} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedContact && (
            <div className="w-[380px] flex-shrink-0 space-y-4">
              <div className="border rounded-2xl p-4 flex items-start gap-3" style={{ borderColor: "#e5e0db", backgroundColor: "#fff" }}>
                <Avatar name={selectedContact.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: "#1a2e1a" }}>{selectedContact.name}</p>
                    <ScoreBadge score={score(selectedContact)} />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "#6b6560" }}>
                    {selectedContact.title} · {selectedContact.company}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={backToContacts}
                className="text-xs hover:underline"
                style={{ color: "#c4855a" }}
              >
                ← Back to contacts
              </button>

              {seqEmails.length === 0 && (
                <>
                  <div>
                    <p className="text-xs font-medium mb-2" style={{ color: "#1a2e1a" }}>Tone</p>
                    <div className="flex flex-wrap gap-2">
                      {(["professional", "casual", "friendly", "bold", "funny"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTone(t)}
                          className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                          style={
                            tone === t
                              ? { backgroundColor: "#1a3a2a", color: "#a8d878" }
                              : { border: "1px solid #dce8d0", color: "#5b534c" }
                          }
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1.5" style={{ color: "#1a2e1a" }}>Any specific instructions?</p>
                    <input
                      type="text"
                      placeholder="e.g. mention we met at the networking dinner, reference their product launch..."
                      value={extraInstructions}
                      onChange={(e) => setExtraInstructions(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-xl outline-none focus:border-[#7ab648]"
                      style={{ borderColor: "#dce8d0", color: "#1a2e1a", backgroundColor: "#fff" }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => selectedContact && handleGenerateSequence(selectedContact)}
                    disabled={seqLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-full border py-3 text-sm font-medium transition-colors"
                  style={{ borderColor: "#1a3a2a", backgroundColor: "#f0f0ec", color: "#1a2e1a" }}
                >
                  {seqLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#1a3a2a] border-t-transparent rounded-full animate-spin" />
                      Claude is writing...
                    </>
                  ) : (
                    "Generate Sequence"
                  )}
                </button>
                </>
              )}

              {seqEmails.length > 0 && (
                <div className="space-y-4">
                  {seqEmails.map((email, i) => (
                    <div key={i} className="border rounded-2xl overflow-hidden" style={{ borderColor: "#e5e0db", backgroundColor: "#fff" }}>
                      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#e5e0db", backgroundColor: "#f0f0ec" }}>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#e5e0db", color: "#1a2e1a" }}>
                            {i + 1}
                          </span>
                          <span className="text-xs font-medium" style={{ color: "#1a2e1a" }}>{email.day}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(`Subject: ${email.subject}\n\n${email.body}`, i)}
                          className="text-xs px-2.5 py-1 border rounded-lg transition-colors"
                          style={{ borderColor: "#e5e0db", color: "#1a2e1a" }}
                        >
                          {copiedIdx === i ? "✓ Copied" : "Copy"}
                        </button>
                      </div>
                      <div className="p-4">
                        <div className="mb-3 pb-3 border-b" style={{ borderColor: "#e5e0db" }}>
                          <span className="text-xs" style={{ color: "#6b6560" }}>Subject: </span>
                          <span className="text-sm font-medium" style={{ color: "#1a2e1a" }}>{email.subject}</span>
                        </div>
                        <pre className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "#1a2e1a", fontFamily: "'DM Sans', sans-serif" }}>
                          {email.body}
                        </pre>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSeqEmails([])}
                    className="w-full py-2 text-xs hover:underline"
                    style={{ color: "#6b6560" }}
                  >
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
