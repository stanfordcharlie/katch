"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/katch-ui";

type Tone = "professional" | "friendly" | "direct";
type CadenceStep = { day: number; tone: Tone };

type ContactRow = {
  id: string;
  name: string | null;
  title: string | null;
  company: string | null;
  email: string | null;
  event: string | null;
  lead_score?: number | null;
  checks?: string[] | null;
  free_note?: string | null;
  ai_enrichment?: Record<string, unknown> | null;
  sequences?: SavedSequence | null;
};

type SavedSequence = {
  generatedAt?: string;
  cadence?: CadenceStep[];
  emails: { day: number; subject: string; body: string }[];
  context?: string;
};

type SeqEmail = { day: number; subject: string; body: string };

type BulkResultRow = {
  contactId: string;
  name: string;
  company: string | null;
  emails: SeqEmail[];
};

const FIELD =
  "w-full box-border border border-[#e8e8e8] rounded-[8px] bg-white px-[14px] py-[10px] text-[14px] text-[#111] outline-none focus:border-[#1a3a2a]";

const DEFAULT_CADENCE: CadenceStep[] = [
  { day: 1, tone: "professional" },
  { day: 4, tone: "professional" },
  { day: 14, tone: "professional" },
];

export default function SequencesPage() {
  const searchParams = useSearchParams();
  const eventFromUrl = searchParams.get("event");

  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [cadence, setCadence] = useState<CadenceStep[]>(() => DEFAULT_CADENCE.map((c) => ({ ...c })));
  const [bulkContext, setBulkContext] = useState("");
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResultRow[] | null>(null);

  const [savedExpandedEvents, setSavedExpandedEvents] = useState<Set<string>>(new Set());
  const [savedViewExpanded, setSavedViewExpanded] = useState<Record<string, boolean>>({});
  const [savedEmailExpanded, setSavedEmailExpanded] = useState<Record<string, boolean>>({});
  const [bulkViewExpanded, setBulkViewExpanded] = useState<Record<string, boolean>>({});
  const [bulkEmailExpanded, setBulkEmailExpanded] = useState<Record<string, boolean>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ subject: string; body: string } | null>(null);
  const [savedEditing, setSavedEditing] = useState<{ contactId: string; emailIndex: number } | null>(null);
  const [savedEditDraft, setSavedEditDraft] = useState<{ subject: string; body: string } | null>(null);
  const [savedEditSaving, setSavedEditSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(data.session.user as User);
    });
  }, []);

  const fetchData = useCallback(async () => {
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
      const [{ data: contactsData, error: ce }, { data: eventsData, error: ee }] = await Promise.all([
        supabase.from("contacts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("events").select("id, name").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);
      if (!ce && contactsData) setContacts(contactsData as ContactRow[]);
      else setContacts([]);
      if (!ee && eventsData) setEvents(eventsData as { id: string; name: string }[]);
      else setEvents([]);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [user?.id, fetchData]);

  useEffect(() => {
    if (eventFromUrl && events.some((e) => e.id === eventFromUrl)) {
      setSelectedEventId(eventFromUrl);
    }
  }, [eventFromUrl, events]);

  const eventsMap = useMemo(() => {
    const m: Record<string, string> = {};
    events.forEach((e) => {
      m[e.id] = e.name;
    });
    return m;
  }, [events]);

  const eventContacts = useMemo(() => {
    if (!selectedEventId) return [];
    return contacts.filter((c) => c.event === selectedEventId);
  }, [contacts, selectedEventId]);

  const selectedEventName = selectedEventId ? eventsMap[selectedEventId] ?? "Event" : "Event";

  const withSavedSequences = useMemo(() => {
    return contacts.filter((c) => Array.isArray(c.sequences?.emails) && (c.sequences!.emails.length ?? 0) > 0);
  }, [contacts]);

  const savedByEvent = useMemo(() => {
    const map = new Map<string, { name: string; list: ContactRow[] }>();
    for (const c of withSavedSequences) {
      const eid = c.event || "__none__";
      const name = c.event ? eventsMap[eid] ?? "Unknown event" : "No event";
      if (!map.has(eid)) map.set(eid, { name, list: [] });
      map.get(eid)!.list.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [withSavedSequences, eventsMap]);

  const updateCadenceDay = (index: number, day: number) => {
    setCadence((prev) => prev.map((s, i) => (i === index ? { ...s, day: Math.max(0, day) } : s)));
  };

  const updateCadenceTone = (index: number, tone: Tone) => {
    setCadence((prev) => prev.map((s, i) => (i === index ? { ...s, tone } : s)));
  };

  const removeCadenceStep = (index: number) => {
    setCadence((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const addCadenceStep = () => {
    setCadence((prev) => [...prev, { day: (prev[prev.length - 1]?.day ?? 1) + 3, tone: "professional" }]);
  };

  const toggleSavedEvent = (key: string) => {
    setSavedExpandedEvents((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const handleBulkGenerate = async () => {
    if (!selectedEventId || eventContacts.length === 0) return;
    setBulkGenerating(true);
    setBulkResults(null);
    try {
      const res = await fetch("/api/sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: eventContacts,
          cadence: cadence.map((c) => ({ day: c.day, tone: c.tone })),
          context: bulkContext.trim() || undefined,
        }),
      });
      const data = await res.json();
      const raw: { contactId: string; emails: SeqEmail[] }[] = data.results ?? [];
      const rows: BulkResultRow[] = raw.map((r) => {
        const c = eventContacts.find((x) => x.id === r.contactId);
        return {
          contactId: r.contactId,
          name: c?.name ?? "Contact",
          company: c?.company ?? null,
          emails: r.emails ?? [],
        };
      });
      setBulkResults(rows);
    } catch (e) {
      console.error(e);
      setBulkResults([]);
    } finally {
      setBulkGenerating(false);
    }
  };

  if (!user) {
    return <div style={{ minHeight: "100vh", background: "#f7f7f5" }} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5", padding: "20px 24px 40px", maxWidth: 960, margin: "0 auto" }}>
      <div
        style={{
          background: "linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 30%, #1e4d6b 70%, #0f2a3d 100%)",
          borderRadius: 16,
          padding: "28px 32px",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>Sequences</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", margin: "8px 0 0", maxWidth: 560 }}>
          AI-generated follow-up emails, personalized for every contact.
        </p>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #ebebeb",
          borderRadius: 16,
          padding: 28,
          marginBottom: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: "0 0 6px" }}>Post-Conference Bulk Sequence</h2>
        <p style={{ fontSize: 14, color: "#666", margin: "0 0 20px" }}>
          Generate a follow-up sequence for all contacts from an event.
        </p>

        <label style={{ fontSize: 13, color: "#666", display: "block", marginBottom: 6 }}>Event</label>
        <select
          className={FIELD}
          style={{ fontFamily: "Inter, sans-serif", marginBottom: 20 }}
          value={selectedEventId}
          onChange={(e) => {
            setSelectedEventId(e.target.value);
            setBulkResults(null);
          }}
        >
          <option value="">Select an event…</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>

        <p style={{ fontSize: 12, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>
          Cadence
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {cadence.map((step, index) => (
            <div key={index} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#666", width: 52 }}>Day</span>
              <input
                type="number"
                min={0}
                className={FIELD}
                style={{ fontFamily: "Inter, sans-serif", width: 88 }}
                value={step.day}
                onChange={(e) => updateCadenceDay(index, parseInt(e.target.value, 10) || 0)}
              />
              <select
                className={FIELD}
                style={{ fontFamily: "Inter, sans-serif", flex: 1, minWidth: 160 }}
                value={step.tone}
                onChange={(e) => updateCadenceTone(index, e.target.value as Tone)}
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="direct">Direct</option>
              </select>
              {cadence.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCadenceStep(index)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#e55a5a",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addCadenceStep}
          style={{
            background: "none",
            border: "none",
            color: "#2d6a1f",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            padding: 0,
            marginBottom: 16,
          }}
        >
          + Add another email
        </button>

        <label style={{ fontSize: 13, color: "#666", display: "block", marginBottom: 6 }}>Optional context</label>
        <textarea
          className={`${FIELD} resize-none`}
          style={{ fontFamily: "Inter, sans-serif", minHeight: 72, marginBottom: 16 }}
          placeholder="Notes for all emails in this batch…"
          value={bulkContext}
          onChange={(e) => setBulkContext(e.target.value)}
        />

        <button
          type="button"
          disabled={bulkGenerating || !selectedEventId || eventContacts.length === 0}
          onClick={() => void handleBulkGenerate()}
          style={{
            width: "100%",
            background: !selectedEventId || eventContacts.length === 0 ? "#ccc" : "#1a3a2a",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "14px 20px",
            fontSize: 15,
            fontWeight: 600,
            cursor: bulkGenerating || !selectedEventId || eventContacts.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          {bulkGenerating
            ? "Generating sequences…"
            : `Generate Sequence for ${selectedEventId ? selectedEventName : "…"}`}
        </button>
        {selectedEventId && eventContacts.length === 0 && (
          <p style={{ fontSize: 13, color: "#999", marginTop: 10 }}>No contacts tagged to this event yet.</p>
        )}
      </div>

      {bulkResults && bulkResults.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 14px" }}>Generated results</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {bulkResults.map((row) => {
              const open = bulkViewExpanded[row.contactId] ?? false;
              return (
                <div
                  key={row.contactId}
                  style={{
                    border: "1px solid #ebebeb",
                    borderRadius: 12,
                    background: "#fff",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      borderBottom: open ? "1px solid #f0f0f0" : "none",
                    }}
                  >
                    <Avatar name={row.name} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: "#111", fontSize: 14 }}>{row.name}</div>
                      <div style={{ fontSize: 12, color: "#999" }}>{row.company ?? "—"}</div>
                    </div>
                    <span style={{ fontSize: 12, color: "#666" }}>{row.emails.length} emails</span>
                    <button
                      type="button"
                      onClick={() =>
                        setBulkViewExpanded((p) => ({ ...p, [row.contactId]: !open }))
                      }
                      style={{
                        background: "#f5f5f5",
                        border: "1px solid #e8e8e8",
                        borderRadius: 8,
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      {open ? "Hide" : "View"}
                    </button>
                  </div>
                  {open && (
                    <div style={{ padding: 16 }}>
                      {row.emails.map((em, i) => {
                        const ek = `${row.contactId}-${i}`;
                        const bodyOpen = bulkEmailExpanded[ek] ?? false;
                        const preview = em.body.length > 160 ? `${em.body.slice(0, 160)}…` : em.body;
                        return (
                          <div
                            key={i}
                            style={{
                              border: "1px solid #f0f0f0",
                              borderRadius: 10,
                              padding: 14,
                              marginBottom: i < row.emails.length - 1 ? 12 : 0,
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#2d6a1f", marginBottom: 6 }}>
                              Day {em.day}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 8 }}>{em.subject}</div>
                            <pre
                              style={{
                                fontSize: 13,
                                color: "#444",
                                whiteSpace: "pre-wrap",
                                fontFamily: "inherit",
                                margin: 0,
                                lineHeight: 1.5,
                              }}
                            >
                              {bodyOpen ? em.body : preview}
                            </pre>
                            {em.body.length > 160 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setBulkEmailExpanded((p) => ({ ...p, [ek]: !bodyOpen }))
                                }
                                style={{
                                  marginTop: 8,
                                  background: "none",
                                  border: "none",
                                  color: "#2d6a1f",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: 500,
                                }}
                              >
                                {bodyOpen ? "Show less" : "Show full body"}
                              </button>
                            )}
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  void navigator.clipboard.writeText(`Subject: ${em.subject}\n\n${em.body}`);
                                }}
                                style={{
                                  background: "#fff",
                                  border: "1px solid #e8e8e8",
                                  borderRadius: 8,
                                  padding: "6px 12px",
                                  fontSize: 12,
                                  cursor: "pointer",
                                }}
                              >
                                Copy
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingKey(ek);
                                  setEditDraft({ subject: em.subject, body: em.body });
                                }}
                                style={{
                                  background: "#fff",
                                  border: "1px solid #e8e8e8",
                                  borderRadius: 8,
                                  padding: "6px 12px",
                                  fontSize: 12,
                                  cursor: "pointer",
                                }}
                              >
                                Edit
                              </button>
                            </div>
                            {editingKey === ek && editDraft && (
                              <div style={{ marginTop: 12 }}>
                                <input
                                  className={FIELD}
                                  style={{ fontFamily: "Inter, sans-serif", marginBottom: 8 }}
                                  value={editDraft.subject}
                                  onChange={(e) => setEditDraft((d) => (d ? { ...d, subject: e.target.value } : d))}
                                />
                                <textarea
                                  className={`${FIELD} resize-none`}
                                  style={{ fontFamily: "Inter, sans-serif", minHeight: 120 }}
                                  value={editDraft.body}
                                  onChange={(e) => setEditDraft((d) => (d ? { ...d, body: e.target.value } : d))}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkResults((prev) => {
                                      if (!prev) return prev;
                                      return prev.map((r) => {
                                        if (r.contactId !== row.contactId) return r;
                                        const next = [...r.emails];
                                        next[i] = { ...next[i], ...editDraft! };
                                        return { ...r, emails: next };
                                      });
                                    });
                                    setEditingKey(null);
                                    setEditDraft(null);
                                  }}
                                  style={{
                                    marginTop: 8,
                                    background: "#1a3a2a",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 8,
                                    padding: "8px 14px",
                                    fontSize: 12,
                                    cursor: "pointer",
                                  }}
                                >
                                  Done
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111", margin: "0 0 14px" }}>Saved Sequences</h2>
        {dataLoading ? (
          <p style={{ color: "#999", fontSize: 14 }}>Loading…</p>
        ) : savedByEvent.length === 0 ? (
          <div
            style={{
              border: "1px dashed #e0e0e0",
              borderRadius: 12,
              padding: 40,
              textAlign: "center",
              color: "#999",
              fontSize: 14,
              background: "#fff",
            }}
          >
            No sequences yet. Generate one above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {savedByEvent.map(([eid, { name, list }]) => {
              const key = eid;
              const open = savedExpandedEvents.has(key);
              return (
                <div
                  key={key}
                  style={{ border: "1px solid #ebebeb", borderRadius: 12, background: "#fff", overflow: "hidden" }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSavedEvent(key)}
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "14px 16px",
                      background: open ? "#fafafa" : "#fff",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "#111", fontSize: 15 }}>{name}</span>
                    <span style={{ fontSize: 13, color: "#666" }}>{list.length} contact{list.length !== 1 ? "s" : ""}</span>
                  </button>
                  {open && (
                    <div style={{ borderTop: "1px solid #f0f0f0" }}>
                      {list.map((c) => {
                        const seq = c.sequences!;
                        const n = seq.emails.length;
                        const vOpen = savedViewExpanded[c.id] ?? false;
                        return (
                          <div key={c.id} style={{ borderBottom: "1px solid #f7f7f7" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "12px 16px",
                              }}
                            >
                              <Avatar name={c.name} size="sm" />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 14, color: "#111" }}>{c.name}</div>
                                <div style={{ fontSize: 12, color: "#999" }}>{c.company ?? "—"}</div>
                              </div>
                              <span style={{ fontSize: 12, color: "#666" }}>{n} emails</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setSavedViewExpanded((p) => ({ ...p, [c.id]: !vOpen }))
                                }
                                style={{
                                  background: "#f5f5f5",
                                  border: "1px solid #e8e8e8",
                                  borderRadius: 8,
                                  padding: "6px 12px",
                                  fontSize: 12,
                                  cursor: "pointer",
                                }}
                              >
                                {vOpen ? "Hide" : "View"}
                              </button>
                            </div>
                            {vOpen && (
                              <div style={{ padding: "0 16px 16px" }}>
                                {seq.emails.map((em, i) => {
                                  const sk = `s-${c.id}-${i}`;
                                  const bodyOpen = savedEmailExpanded[sk] ?? false;
                                  const preview = em.body.length > 160 ? `${em.body.slice(0, 160)}…` : em.body;
                                  return (
                                    <div
                                      key={i}
                                      style={{
                                        border: "1px solid #f0f0f0",
                                        borderRadius: 10,
                                        padding: 12,
                                        marginBottom: 8,
                                      }}
                                    >
                                      <div style={{ fontSize: 12, fontWeight: 600, color: "#2d6a1f" }}>Day {em.day}</div>
                                      <div style={{ fontSize: 14, fontWeight: 600, margin: "6px 0" }}>{em.subject}</div>
                                      <pre
                                        style={{
                                          fontSize: 13,
                                          color: "#444",
                                          whiteSpace: "pre-wrap",
                                          fontFamily: "inherit",
                                          margin: 0,
                                        }}
                                      >
                                        {bodyOpen ? em.body : preview}
                                      </pre>
                                      {em.body.length > 160 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setSavedEmailExpanded((p) => ({ ...p, [sk]: !bodyOpen }))
                                          }
                                          style={{
                                            marginTop: 6,
                                            background: "none",
                                            border: "none",
                                            color: "#2d6a1f",
                                            cursor: "pointer",
                                            fontSize: 12,
                                          }}
                                        >
                                          {bodyOpen ? "Show less" : "Show full body"}
                                        </button>
                                      )}
                                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void navigator.clipboard.writeText(`Subject: ${em.subject}\n\n${em.body}`)
                                          }
                                          style={{
                                            background: "#fff",
                                            border: "1px solid #e8e8e8",
                                            borderRadius: 8,
                                            padding: "6px 12px",
                                            fontSize: 12,
                                            cursor: "pointer",
                                          }}
                                        >
                                          Copy
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSavedEditing({ contactId: c.id, emailIndex: i });
                                            setSavedEditDraft({ subject: em.subject, body: em.body });
                                          }}
                                          style={{
                                            background: "#fff",
                                            border: "1px solid #e8e8e8",
                                            borderRadius: 8,
                                            padding: "6px 12px",
                                            fontSize: 12,
                                            cursor: "pointer",
                                          }}
                                        >
                                          Edit
                                        </button>
                                      </div>
                                      {savedEditing?.contactId === c.id &&
                                        savedEditing.emailIndex === i &&
                                        savedEditDraft && (
                                          <div style={{ marginTop: 12 }}>
                                            <input
                                              className={FIELD}
                                              style={{ fontFamily: "Inter, sans-serif", marginBottom: 8 }}
                                              value={savedEditDraft.subject}
                                              onChange={(e) =>
                                                setSavedEditDraft((d) => (d ? { ...d, subject: e.target.value } : d))
                                              }
                                            />
                                            <textarea
                                              className={`${FIELD} resize-none`}
                                              style={{ fontFamily: "Inter, sans-serif", minHeight: 100 }}
                                              value={savedEditDraft.body}
                                              onChange={(e) =>
                                                setSavedEditDraft((d) => (d ? { ...d, body: e.target.value } : d))
                                              }
                                            />
                                            <button
                                              type="button"
                                              disabled={savedEditSaving}
                                              onClick={async () => {
                                                if (!user?.id || !savedEditDraft) return;
                                                setSavedEditSaving(true);
                                                try {
                                                  const seq = c.sequences!;
                                                  const nextEmails = [...seq.emails];
                                                  nextEmails[i] = {
                                                    ...nextEmails[i],
                                                    subject: savedEditDraft.subject,
                                                    body: savedEditDraft.body,
                                                  };
                                                  const { error } = await supabase
                                                    .from("contacts")
                                                    .update({
                                                      sequences: {
                                                        ...seq,
                                                        emails: nextEmails,
                                                      },
                                                    })
                                                    .eq("id", c.id)
                                                    .eq("user_id", user.id);
                                                  if (error) throw error;
                                                  setSavedEditing(null);
                                                  setSavedEditDraft(null);
                                                  await fetchData();
                                                } catch (e) {
                                                  console.error(e);
                                                } finally {
                                                  setSavedEditSaving(false);
                                                }
                                              }}
                                              style={{
                                                marginTop: 8,
                                                background: savedEditSaving ? "#ccc" : "#1a3a2a",
                                                color: "#fff",
                                                border: "none",
                                                borderRadius: 8,
                                                padding: "8px 14px",
                                                fontSize: 12,
                                                cursor: savedEditSaving ? "not-allowed" : "pointer",
                                              }}
                                            >
                                              {savedEditSaving ? "Saving…" : "Save changes"}
                                            </button>
                                          </div>
                                        )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
