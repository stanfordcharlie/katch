"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  events?: { name: string } | null;
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

const PER_CONTACT_FETCH_TIMEOUT_MS = 300_000;

type BulkTargetMode = "event" | "contact";

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
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResultRow[] | null>(null);

  const [savedExpandedEvents, setSavedExpandedEvents] = useState<Set<string>>(new Set());
  const [savedViewExpanded, setSavedViewExpanded] = useState<Record<string, boolean>>({});
  const [savedEmailExpanded, setSavedEmailExpanded] = useState<Record<string, boolean>>({});
  const [bulkViewExpanded, setBulkViewExpanded] = useState<Record<string, boolean>>({});
  const [bulkEmailExpanded, setBulkEmailExpanded] = useState<Record<string, boolean>>({});
  const [bulkTargetMode, setBulkTargetMode] = useState<BulkTargetMode>("event");
  const [contactSearchInput, setContactSearchInput] = useState("");
  const [contactSearchResults, setContactSearchResults] = useState<ContactRow[]>([]);
  const [contactSearchLoading, setContactSearchLoading] = useState(false);
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const [selectedBulkContact, setSelectedBulkContact] = useState<ContactRow | null>(null);
  const contactSearchWrapRef = useRef<HTMLDivElement | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ subject: string; body: string } | null>(null);
  const [savedEditing, setSavedEditing] = useState<{ contactId: string; emailIndex: number } | null>(null);
  const [savedEditDraft, setSavedEditDraft] = useState<{ subject: string; body: string } | null>(null);
  const [savedEditSaving, setSavedEditSaving] = useState(false);
  const [sequenceDeleteToast, setSequenceDeleteToast] = useState<string | null>(null);
  const [savedBulkSelectedIds, setSavedBulkSelectedIds] = useState<Set<string>>(() => new Set());

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
        supabase
          .from("contacts")
          .select(
            "id, name, title, company, email, checks, free_note, ai_enrichment, lead_score, event, sequences, created_at, events(name)"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("events").select("id, name").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);
      if (!ce && contactsData) setContacts(contactsData as any);
      else setContacts([]);
      if (!ee && eventsData) setEvents((eventsData || []).map((e: any) => ({ id: String(e.id), name: String(e.name ?? '') })));
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

  useEffect(() => {
    if (bulkTargetMode !== "contact") return;
    const onDown = (e: MouseEvent) => {
      if (contactSearchWrapRef.current && !contactSearchWrapRef.current.contains(e.target as Node)) {
        setContactSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [bulkTargetMode]);

  useEffect(() => {
    if (bulkTargetMode !== "contact") {
      setContactSearchResults([]);
      setContactSearchLoading(false);
      return;
    }
    const q = contactSearchInput.trim();
    if (q.length < 1) {
      setContactSearchResults([]);
      setContactSearchLoading(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        setContactSearchLoading(true);
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) {
          if (!cancelled) {
            setContactSearchLoading(false);
            setContactSearchResults([]);
          }
          return;
        }
        const { data, error } = await supabase
          .from("contacts")
          .select(
            "id, name, title, company, email, checks, free_note, ai_enrichment, lead_score, event, sequences, created_at"
          )
          .eq("user_id", userId)
          .ilike("name", `%${q}%`)
          .order("created_at", { ascending: false })
          .limit(20);
        if (cancelled) return;
        setContactSearchLoading(false);
        if (!error && data) setContactSearchResults(data as ContactRow[]);
        else setContactSearchResults([]);
      })();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [bulkTargetMode, contactSearchInput]);

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

  type SavedSequenceGroup = { groupKey: string; headerLabel: string | null; list: ContactRow[] };

  const savedByEvent = useMemo((): SavedSequenceGroup[] => {
    const map = new Map<string, { headerLabel: string | null; list: ContactRow[] }>();
    for (const c of withSavedSequences) {
      const eventId = c.event;
      const resolvedName = c.events?.name ?? null;
      let groupKey: string;
      let headerLabel: string | null;
      if (eventId && resolvedName) {
        groupKey = eventId;
        headerLabel = resolvedName;
      } else {
        groupKey = "__ungrouped__";
        headerLabel = null;
      }
      if (!map.has(groupKey)) {
        map.set(groupKey, { headerLabel, list: [] });
      }
      map.get(groupKey)!.list.push(c);
    }
    const out: SavedSequenceGroup[] = [];
    for (const [groupKey, { headerLabel, list }] of map.entries()) {
      out.push({ groupKey, headerLabel, list });
    }
    out.sort((a, b) => {
      if (a.headerLabel === null && b.headerLabel === null) return 0;
      if (a.headerLabel === null) return 1;
      if (b.headerLabel === null) return -1;
      return a.headerLabel.localeCompare(b.headerLabel);
    });
    return out;
  }, [withSavedSequences]);

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
    const toPayload = (c: ContactRow) => ({
      id: c.id,
      name: c.name,
      title: c.title,
      company: c.company,
      email: c.email,
      checks: c.checks,
      free_note: c.free_note,
      ai_enrichment: c.ai_enrichment,
      lead_score: c.lead_score,
      event: c.event,
    });

    let contactsPayload: ReturnType<typeof toPayload>[];
    if (bulkTargetMode === "event") {
      if (!selectedEventId || eventContacts.length === 0) return;
      contactsPayload = eventContacts.map(toPayload);
    } else {
      if (!selectedBulkContact) return;
      contactsPayload = [toPayload(selectedBulkContact)];
    }

    const rowName = (id: string) =>
      contacts.find((x) => x.id === id)?.name ??
      (selectedBulkContact?.id === id ? selectedBulkContact.name : null) ??
      "Contact";
    const rowCompany = (id: string) =>
      contacts.find((x) => x.id === id)?.company ??
      (selectedBulkContact?.id === id ? selectedBulkContact.company : null) ??
      null;

    setBulkGenerating(true);
    setBulkError(null);
    setBulkResults([]);
    setBulkProgress({ current: 0, total: contactsPayload.length });

    const cadencePayload = cadence.map((c) => ({ day: c.day, tone: c.tone }));
    const contextTrimmed = bulkContext.trim() || undefined;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      setBulkError("Not signed in.");
      setBulkGenerating(false);
      setBulkProgress(null);
      setBulkResults(null);
      return;
    }

    const rows: BulkResultRow[] = [];

    try {
      for (let i = 0; i < contactsPayload.length; i++) {
        const c = contactsPayload[i];
        setBulkProgress({ current: i + 1, total: contactsPayload.length });

        const singleBody = { contact: c, cadence: cadencePayload, context: contextTrimmed };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PER_CONTACT_FETCH_TIMEOUT_MS);

        try {
          const res = await fetch("/api/sequence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(singleBody),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            const errBody = await res.text().catch(() => "(could not read body)");
            console.log("[sequences bulk] request body (one contact):", JSON.stringify(singleBody));
            console.log("[sequences bulk] response not ok — contact:", c.id, "status:", res.status, "body:", errBody);
            rows.push({
              contactId: c.id,
              name: rowName(c.id),
              company: rowCompany(c.id),
              emails: [],
            });
            setBulkResults([...rows]);
            continue;
          }

          let data: { contactId?: string; emails?: SeqEmail[] };
          try {
            data = (await res.json()) as { contactId?: string; emails?: SeqEmail[] };
          } catch (parseErr) {
            console.log("[sequences bulk] request body (one contact):", JSON.stringify(singleBody));
            console.log("[sequences bulk] JSON parse failed — contact:", c.id, parseErr);
            rows.push({
              contactId: c.id,
              name: rowName(c.id),
              company: rowCompany(c.id),
              emails: [],
            });
            setBulkResults([...rows]);
            continue;
          }
          const contactId = data.contactId ?? c.id;
          const emails = data.emails ?? [];
          rows.push({
            contactId,
            name: rowName(contactId),
            company: rowCompany(contactId),
            emails,
          });
          setBulkResults([...rows]);
        } catch (e) {
          clearTimeout(timeoutId);
          console.log("[sequences bulk] request body (one contact):", JSON.stringify(singleBody));
          console.log("[sequences bulk] contact failed:", c.id, e);
          rows.push({
            contactId: c.id,
            name: rowName(c.id),
            company: rowCompany(c.id),
            emails: [],
          });
          setBulkResults([...rows]);
        }
      }

      const cadenceToSave = cadence.map((x) => ({ day: x.day, tone: x.tone }));
      for (const row of rows) {
        if (row.emails.length === 0) continue;
        const { error } = await supabase
          .from("contacts")
          .update({
            sequences: {
              generatedAt: new Date().toISOString(),
              cadence: cadenceToSave,
              emails: row.emails,
              context: contextTrimmed,
            },
          })
          .eq("id", row.contactId)
          .eq("user_id", userId);
        if (error) console.error("[sequences bulk] save failed:", row.contactId, error);
      }

      await fetchData();
    } catch (e) {
      console.log("[sequences bulk] error:", e);
      setBulkError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBulkProgress(null);
      setBulkGenerating(false);
    }
  };

  const handleDeleteSequence = async (contactId: string, _contactName?: string | null | undefined) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    const { error } = await supabase
      .from("contacts")
      .update({ sequences: null })
      .eq("id", contactId)
      .eq("user_id", userId);
    if (error) {
      console.error(error);
      return;
    }
    setBulkResults((prev) => {
      if (!prev) return null;
      const next = prev.filter((r) => r.contactId !== contactId);
      return next.length === 0 ? null : next;
    });
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, sequences: null } : c)));
    setEditingKey((k) => (k && k.startsWith(`${contactId}-`) ? null : k));
    setSavedEditing((s) => (s?.contactId === contactId ? null : s));
    setSavedBulkSelectedIds((prev) => {
      if (!prev.has(contactId)) return prev;
      const n = new Set(prev);
      n.delete(contactId);
      return n;
    });
    setSequenceDeleteToast("Sequence deleted");
    window.setTimeout(() => setSequenceDeleteToast(null), 2500);
  };

  const handleSavedBulkDeleteSelected = async () => {
    const ids = Array.from(savedBulkSelectedIds);
    if (ids.length === 0) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    const { error } = await supabase
      .from("contacts")
      .update({ sequences: null })
      .in("id", ids)
      .eq("user_id", userId);
    if (error) {
      console.error(error);
      return;
    }
    const idSet = new Set(ids);
    setBulkResults((prev) => {
      if (!prev) return null;
      const next = prev.filter((r) => !idSet.has(r.contactId));
      return next.length === 0 ? null : next;
    });
    setContacts((prev) => prev.map((c) => (idSet.has(c.id) ? { ...c, sequences: null } : c)));
    setEditingKey((k) => {
      if (!k) return k;
      return ids.some((id) => k.startsWith(`${id}-`)) ? null : k;
    });
    setSavedEditing((s) => (s && idSet.has(s.contactId) ? null : s));
    setSavedBulkSelectedIds(new Set());
    setSequenceDeleteToast("Sequence deleted");
    window.setTimeout(() => setSequenceDeleteToast(null), 2500);
  };

  if (!user) {
    return <div style={{ minHeight: "100vh", background: "#f7f7f5" }} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5", padding: "20px 24px 40px", maxWidth: 960, margin: "0 auto" }}>
      {sequenceDeleteToast && (
        <div
          style={{
            position: "fixed",
            bottom: 32,
            right: 32,
            zIndex: 9999,
            background: "#1a3a2a",
            color: "#fff",
            borderRadius: 10,
            padding: "12px 16px",
            fontSize: 14,
            fontWeight: 500,
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            maxWidth: "calc(100vw - 64px)",
          }}
        >
          {sequenceDeleteToast}
        </div>
      )}
      <div
        className="w-full rounded-2xl p-8"
        style={{
          background:
            "linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 30%, #1e4d6b 70%, #0f2a3d 100%)",
          marginBottom: 24,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#fff",
            margin: 0,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Sequences
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.6)",
            marginTop: 4,
            marginBottom: 0,
            maxWidth: 560,
            fontFamily: "Inter, sans-serif",
          }}
        >
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
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => {
              setBulkTargetMode("event");
              setContactSearchInput("");
              setSelectedBulkContact(null);
              setContactSearchResults([]);
              setContactSearchOpen(false);
              setBulkResults(null);
              setBulkError(null);
            }}
            style={{
              background: bulkTargetMode === "event" ? "#1a3a2a" : "#f0f0f0",
              color: bulkTargetMode === "event" ? "#fff" : "#666",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            By Event
          </button>
          <button
            type="button"
            onClick={() => {
              setBulkTargetMode("contact");
              setBulkResults(null);
              setBulkError(null);
            }}
            style={{
              background: bulkTargetMode === "contact" ? "#1a3a2a" : "#f0f0f0",
              color: bulkTargetMode === "contact" ? "#fff" : "#666",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            By Contact
          </button>
        </div>
        <p style={{ fontSize: 14, color: "#666", margin: "0 0 20px" }}>
          Generate a follow-up sequence for all contacts from an event.
        </p>

        {bulkTargetMode === "event" ? (
          <>
            <label style={{ fontSize: 13, color: "#666", display: "block", marginBottom: 6 }}>Event</label>
            <select
              className={FIELD}
              style={{ fontFamily: "Inter, sans-serif", marginBottom: 20 }}
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setBulkResults(null);
                setBulkError(null);
              }}
            >
              <option value="">Select an event…</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label style={{ fontSize: 13, color: "#666", display: "block", marginBottom: 6 }}>Contact</label>
            <div ref={contactSearchWrapRef} style={{ position: "relative", marginBottom: 20 }}>
              <input
                type="text"
                className={FIELD}
                placeholder="Search contacts..."
                value={contactSearchInput}
                onChange={(e) => {
                  setContactSearchInput(e.target.value);
                  setSelectedBulkContact(null);
                  setContactSearchOpen(true);
                }}
                onFocus={() => setContactSearchOpen(true)}
                style={{ fontFamily: "Inter, sans-serif", width: "100%", boxSizing: "border-box" }}
              />
              {contactSearchOpen && contactSearchInput.trim().length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "100%",
                    marginTop: 4,
                    background: "#fff",
                    border: "1px solid #e8e8e8",
                    borderRadius: 8,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    maxHeight: 240,
                    overflowY: "auto",
                    zIndex: 20,
                  }}
                >
                  {contactSearchLoading ? (
                    <div style={{ padding: 12, fontSize: 13, color: "#999" }}>Searching…</div>
                  ) : contactSearchResults.length === 0 ? (
                    <div style={{ padding: 12, fontSize: 13, color: "#999" }}>No contacts found.</div>
                  ) : (
                    contactSearchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedBulkContact(c);
                          setContactSearchInput(c.name || "");
                          setContactSearchOpen(false);
                          setBulkResults(null);
                          setBulkError(null);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          width: "100%",
                          padding: "10px 12px",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          boxSizing: "border-box",
                        }}
                      >
                        <Avatar name={c.name ?? ''} size="sm" />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{c.name || "Unknown"}</div>
                          <div style={{ fontSize: 12, color: "#999" }}>{c.company || "—"}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {bulkTargetMode === "event" && selectedEventId && eventContacts.length > 10 && (
          <p
            style={{
              fontSize: 14,
              color: "#b45309",
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 16,
              lineHeight: 1.45,
            }}
          >
            This will generate sequences for {eventContacts.length} contacts. This may take a few minutes.
          </p>
        )}

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
          disabled={
            bulkGenerating ||
            (bulkTargetMode === "event" && (!selectedEventId || eventContacts.length === 0)) ||
            (bulkTargetMode === "contact" && !selectedBulkContact)
          }
          onClick={() => void handleBulkGenerate()}
          style={{
            width: "100%",
            background:
              bulkGenerating ||
              (bulkTargetMode === "event" && (!selectedEventId || eventContacts.length === 0)) ||
              (bulkTargetMode === "contact" && !selectedBulkContact)
                ? "#ccc"
                : "#1a3a2a",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "14px 20px",
            fontSize: 15,
            fontWeight: 600,
            cursor:
              bulkGenerating ||
              (bulkTargetMode === "event" && (!selectedEventId || eventContacts.length === 0)) ||
              (bulkTargetMode === "contact" && !selectedBulkContact)
                ? "not-allowed"
                : "pointer",
          }}
        >
          {bulkGenerating
            ? "Generating sequences…"
            : bulkTargetMode === "event"
              ? `Generate Sequence for ${selectedEventId ? selectedEventName : "…"}`
              : `Generate Sequence for ${selectedBulkContact?.name?.trim() || "…"}`}
        </button>
        {bulkGenerating && bulkProgress && (
          <p style={{ fontSize: 14, color: "#666", marginTop: 12, marginBottom: 0 }}>
            Generating {bulkProgress.current} of {bulkProgress.total}…
          </p>
        )}
        {bulkError && (
          <p
            role="alert"
            style={{
              fontSize: 14,
              color: "#b91c1c",
              marginTop: 12,
              marginBottom: 0,
              lineHeight: 1.45,
            }}
          >
            {bulkError}
          </p>
        )}
        {bulkTargetMode === "event" && selectedEventId && eventContacts.length === 0 && (
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexShrink: 0,
                      }}
                    >
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
                      <button
                        onClick={() => handleDeleteSequence(row.contactId, row.name || "")}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#e55a5a")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#ccc")}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "4px 6px",
                          borderRadius: 4,
                          color: "#ccc",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </div>
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
        {savedBulkSelectedIds.size > 0 && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #ebebeb",
              borderRadius: 8,
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, color: "#111" }}>{savedBulkSelectedIds.size} selected</span>
            <button
              type="button"
              onClick={() => void handleSavedBulkDeleteSelected()}
              style={{
                background: "#fff",
                border: "1px solid #fde8e8",
                color: "#e55a5a",
                fontSize: 12,
                padding: "6px 14px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Delete selected
            </button>
          </div>
        )}
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
            {savedByEvent.map(({ groupKey, headerLabel, list }) => {
              const open = headerLabel === null ? true : savedExpandedEvents.has(groupKey);
              return (
                <div
                  key={groupKey}
                  style={{ border: "1px solid #ebebeb", borderRadius: 12, background: "#fff", overflow: "hidden" }}
                >
                  {headerLabel !== null && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 16px",
                        background: open ? "#fafafa" : "#fff",
                      }}
                    >
                      <input
                        type="checkbox"
                        ref={(el) => {
                          if (!el) return;
                          const allSelected = list.length > 0 && list.every((c) => savedBulkSelectedIds.has(c.id));
                          const someSelected = list.some((c) => savedBulkSelectedIds.has(c.id));
                          el.indeterminate = someSelected && !allSelected;
                        }}
                        checked={list.length > 0 && list.every((c) => savedBulkSelectedIds.has(c.id))}
                        onChange={() => {
                          setSavedBulkSelectedIds((prev) => {
                            const n = new Set(prev);
                            const allSelected = list.every((c) => n.has(c.id));
                            if (allSelected) list.forEach((c) => n.delete(c.id));
                            else list.forEach((c) => n.add(c.id));
                            return n;
                          });
                        }}
                        style={{ flexShrink: 0, width: 16, height: 16, cursor: "pointer" }}
                        aria-label="Select all contacts in this group"
                      />
                      <button
                        type="button"
                        onClick={() => toggleSavedEvent(groupKey)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                          padding: 0,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: "#111", fontSize: 15 }}>{headerLabel}</span>
                        <span style={{ fontSize: 13, color: "#666" }}>
                          {list.length} contact{list.length !== 1 ? "s" : ""}
                        </span>
                      </button>
                    </div>
                  )}
                  {(headerLabel === null || open) && (
                    <div
                      style={{
                        borderTop: headerLabel !== null ? "1px solid #f0f0f0" : "none",
                      }}
                    >
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
                              <input
                                type="checkbox"
                                checked={savedBulkSelectedIds.has(c.id)}
                                onChange={() => {
                                  setSavedBulkSelectedIds((prev) => {
                                    const n = new Set(prev);
                                    if (n.has(c.id)) n.delete(c.id);
                                    else n.add(c.id);
                                    return n;
                                  });
                                }}
                                style={{ flexShrink: 0, width: 16, height: 16, cursor: "pointer" }}
                                aria-label={`Select ${c.name || "contact"}`}
                              />
                              <Avatar name={c.name ?? ""} size="sm" />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 14, color: "#111" }}>{c.name}</div>
                                <div style={{ fontSize: 12, color: "#999" }}>{c.company ?? "—"}</div>
                              </div>
                              <span style={{ fontSize: 12, color: "#666", flexShrink: 0 }}>{n} emails</span>
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
                                  flexShrink: 0,
                                }}
                              >
                                {vOpen ? "Hide" : "View"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSequence(c.id, c.name || "")}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "#e55a5a")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "#ccc")}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#ccc",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  fontSize: 18,
                                  lineHeight: 1,
                                  display: "flex",
                                  alignItems: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <span style={{ fontSize: 16, lineHeight: 1 }}>×</span>
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
