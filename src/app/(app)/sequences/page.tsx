"use client";

import { useState, useEffect, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import { useSearchParams, useRouter } from "next/navigation";
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
  const router = useRouter();
  const contactIdFromUrl = searchParams.get("contactId");
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
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
      setDataLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) {
          setContacts([]);
          setEvents([]);
          return;
        }
        const { data: contactsData, error: contactsError } = await supabase
          .from("contacts")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (contactsError) {
          console.error("Sequences page contacts fetch:", contactsError);
          setContacts([]);
        } else {
          setContacts((contactsData as Contact[]) ?? []);
        }
        const { data: eventsData, error: eventsError } = await supabase
          .from("events")
          .select("id, name")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (eventsError) {
          console.error("Sequences page events fetch:", eventsError);
          setEvents([]);
        } else {
          setEvents((eventsData as EventRow[]) ?? []);
        }
      } catch (err) {
        console.error("Sequences page data fetch:", err);
        setContacts([]);
        setEvents([]);
      } finally {
        setDataLoading(false);
      }
    };
    void fetchData();
  }, [user?.id]);

  const { byEvent, unassigned } = useMemo(() => {
    const byEvent: { eventName: string; eventId?: string; contacts: Contact[] }[] = [];
    const eventNameSet = new Set(
      events.map((e) => e.name).filter((n): n is string => n != null && String(n).trim() !== "")
    );
    for (const ev of events) {
      const list = contacts.filter((c) => getContactEvent(c) === ev.name);
      if (list.length > 0) byEvent.push({ eventName: ev.name, eventId: ev.id, contacts: list });
    }
    const unassigned = contacts.filter((c) => {
      const ev = getContactEvent(c);
      if (ev === null) return true;
      return !eventNameSet.has(ev);
    });
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

  const handleHeaderGenerateSequence = () => {
    if (contacts.length === 0) {
      router.push("/scan");
      return;
    }
    selectContact(contacts[0]);
  };

  const score = (c: Contact) => Number(c.lead_score ?? c.leadScore) || 0;

  if (!user) return <div className="min-h-screen bg-[#f0f0ec]" />;

  return (
    <>
      <div
        className="min-h-screen bg-[#f0f0ec] px-5 py-7"
        style={{ color: "#1a2e1a" }}
      >
        <div className={selectedContact ? "max-w-5xl mx-auto flex gap-8" : "max-w-2xl mx-auto"}>
          <div className={selectedContact ? "flex-1 min-w-0" : "w-full"}>
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1
                  style={{
                    fontSize: "24px",
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.2,
                    color: "#1a2e1a",
                    margin: 0,
                  }}
                >
                  Sequences
                </h1>
                <p
                  className="mt-0.5"
                  style={{ fontSize: "13px", fontWeight: 400, color: "#999" }}
                >
                  AI-generated follow-up emails by event
                </p>
              </div>
              <button
                type="button"
                onClick={handleHeaderGenerateSequence}
                style={{
                  background: "#1a3a2a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                  alignSelf: "flex-start",
                }}
              >
                Generate Sequence
              </button>
            </div>

            {dataLoading ? (
              <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: "#e5e0db", backgroundColor: "#fff" }}>
                <div className="h-4 rounded-lg animate-pulse" style={{ backgroundColor: "#e5e0db", width: "60%" }} />
                <div className="h-4 rounded-lg animate-pulse" style={{ backgroundColor: "#e5e0db", width: "80%" }} />
                <div className="h-4 rounded-lg animate-pulse" style={{ backgroundColor: "#e5e0db", width: "40%" }} />
                <div className="h-24 rounded-xl border mt-4 animate-pulse" style={{ borderColor: "#e5e0db", backgroundColor: "#f5f5f5" }} />
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-16 px-6 border-2 border-dashed rounded-2xl" style={{ borderColor: "#e5e0db" }}>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "#f0f7eb" }}>
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#7ab648" strokeWidth="1.5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <p className="mb-1" style={{ fontSize: "14px", fontWeight: 600, lineHeight: 1.5, color: "#1a2e1a" }}>
                  No sequences yet
                </p>
                <p className="mb-6" style={{ fontSize: "13px", fontWeight: 400, color: "#999" }}>
                  Generate an AI follow-up sequence for your contacts
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/scan")}
                  style={{
                    background: "#1a3a2a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 24px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Generate Sequence
                </button>
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
                        <span
                          style={{
                            fontSize: "17px",
                            fontWeight: 600,
                            letterSpacing: "-0.01em",
                            color: "#1a2e1a",
                          }}
                        >
                          {eventName}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-full border"
                          style={{
                            fontSize: "13px",
                            fontWeight: 400,
                            borderColor: "#c4855a",
                            color: "#c4855a",
                          }}
                        >
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
                                <p
                                  className="truncate"
                                  style={{
                                    fontSize: "15px",
                                    fontWeight: 600,
                                    letterSpacing: "-0.01em",
                                    color: "#1a2e1a",
                                  }}
                                >
                                  {c.name}
                                </p>
                                <p className="truncate" style={{ fontSize: "13px", fontWeight: 400, color: "#999" }}>
                                  {c.title} · {c.company}
                                </p>
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
                      <span
                        style={{
                          fontSize: "17px",
                          fontWeight: 600,
                          letterSpacing: "-0.01em",
                          color: "#1a2e1a",
                        }}
                      >
                        Unassigned
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full border"
                        style={{
                          fontSize: "13px",
                          fontWeight: 400,
                          borderColor: "#c4855a",
                          color: "#c4855a",
                        }}
                      >
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
                              <p
                                className="truncate"
                                style={{
                                  fontSize: "15px",
                                  fontWeight: 600,
                                  letterSpacing: "-0.01em",
                                  color: "#1a2e1a",
                                }}
                              >
                                {c.name}
                              </p>
                              <p className="truncate" style={{ fontSize: "13px", fontWeight: 400, color: "#999" }}>
                                {c.title ?? ""} · {c.company ?? ""}
                              </p>
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
                    <p
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                        color: "#1a2e1a",
                      }}
                    >
                      {selectedContact.name}
                    </p>
                    <ScoreBadge score={score(selectedContact)} />
                  </div>
                  <p className="mt-0.5" style={{ fontSize: "13px", fontWeight: 400, color: "#999" }}>
                    {selectedContact.title} · {selectedContact.company}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={backToContacts}
                className="hover:underline"
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  color: "#c4855a",
                }}
              >
                ← Back to contacts
              </button>

              {seqEmails.length === 0 && (
                <>
                  <div>
                    <p
                      className="mb-2"
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "#1a2e1a",
                      }}
                    >
                      Tone
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(["professional", "casual", "friendly", "bold", "funny"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTone(t)}
                          className="px-3 py-1.5 rounded-full transition-colors"
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            letterSpacing: "-0.01em",
                            ...(tone === t
                              ? { backgroundColor: "#1a3a2a", color: "#a8d878" }
                              : { border: "1px solid #dce8d0", color: "#5b534c" }),
                          }}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p
                      className="mb-1.5"
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "#1a2e1a",
                      }}
                    >
                      Any specific instructions?
                    </p>
                    <input
                      type="text"
                      placeholder="e.g. mention we met at the networking dinner, reference their product launch..."
                      value={extraInstructions}
                      onChange={(e) => setExtraInstructions(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl outline-none focus:border-[#7ab648]"
                      style={{
                        fontSize: "14px",
                        fontWeight: 400,
                        lineHeight: 1.5,
                        borderColor: "#dce8d0",
                        color: "#1a2e1a",
                        backgroundColor: "#fff",
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => selectedContact && handleGenerateSequence(selectedContact)}
                    disabled={seqLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-full border py-3 transition-colors"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      borderColor: "#1a3a2a",
                      backgroundColor: "#f0f0ec",
                      color: "#1a2e1a",
                    }}
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
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              letterSpacing: "-0.01em",
                              backgroundColor: "#e5e0db",
                              color: "#1a2e1a",
                            }}
                          >
                            {i + 1}
                          </span>
                          <span
                            style={{
                              fontSize: "15px",
                              fontWeight: 600,
                              letterSpacing: "-0.01em",
                              color: "#1a2e1a",
                            }}
                          >
                            {email.day}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(`Subject: ${email.subject}\n\n${email.body}`, i)}
                          className="px-2.5 py-1 border rounded-lg transition-colors"
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            letterSpacing: "-0.01em",
                            borderColor: "#e5e0db",
                            color: "#1a2e1a",
                          }}
                        >
                          {copiedIdx === i ? "✓ Copied" : "Copy"}
                        </button>
                      </div>
                      <div className="p-4">
                        <div className="mb-3 pb-3 border-b" style={{ borderColor: "#e5e0db" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              color: "#1a2e1a",
                            }}
                          >
                            Subject:{" "}
                          </span>
                          <span
                            style={{
                              fontSize: "15px",
                              fontWeight: 600,
                              letterSpacing: "-0.01em",
                              color: "#1a2e1a",
                            }}
                          >
                            {email.subject}
                          </span>
                        </div>
                        <pre
                          className="whitespace-pre-wrap"
                          style={{
                            fontSize: "14px",
                            fontWeight: 400,
                            lineHeight: 1.5,
                            color: "#1a2e1a",
                          }}
                        >
                          {email.body}
                        </pre>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSeqEmails([])}
                    className="w-full py-2 hover:underline"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      color: "#999",
                    }}
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
