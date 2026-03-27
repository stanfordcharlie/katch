"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { EVENT_TYPES } from "@/lib/katch-constants";

export default function EventsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactEventLinks, setContactEventLinks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [evForm, setEvForm] = useState({
    name: "",
    date: "",
    type: "Conference",
    location: "",
    notes: "",
    attendees: [] as string[],
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [isSyncingEvent, setIsSyncingEvent] = useState<string | null>(null);
  const [isParsingListEvent, setIsParsingListEvent] = useState<string | null>(null);
  const [leadListResultsModal, setLeadListResultsModal] = useState<{
    eventId: string;
    eventName: string;
    contacts: any[];
  } | null>(null);
  const [selectedLeadListIds, setSelectedLeadListIds] = useState<string[]>([]);
  const [isSavingLeadList, setIsSavingLeadList] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{
    open: boolean;
    progress: number;
    current: number;
    total: number;
    eventName: string;
  }>({ open: false, progress: 0, current: 0, total: 0, eventName: "" });
  const [importEventId, setImportEventId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const enrichAbortRef = useRef<AbortController | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(data.session.user as User);
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      const { data: eventsData } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      const { data: contactsByEvent } = await supabase
        .from("contacts")
        .select("id, event")
        .eq("user_id", userId);
      if (contactsData) {
        setContacts((contactsData as any[]) || []);
        setAllContacts(
          (contactsData as any[]).map((c) => ({
            id: c.id,
            name: c.name,
            title: c.title,
            company: c.company,
            lead_score: c.lead_score,
            email: c.email,
            image: c.image,
            event: c.event,
          })) || []
        );
      }
      if (eventsData) setEvents((eventsData as any[]) || []);
      if (contactsByEvent) setContactEventLinks((contactsByEvent as any[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [user?.id]);

  const getContactCount = (eventId: string) => {
    return contactEventLinks?.filter((c) => c.event === eventId).length || 0;
  };

  const showToast = (msg: string, variant: "success" | "error" = "success") => {
    setToast({ message: msg, variant });
    setTimeout(() => setToast(null), 2500);
  };

  const syncEventToHubSpot = async (eventId: string) => {
    if (!user?.id) return;
    setIsSyncingEvent(eventId);
    try {
      const { data: rows, error } = await supabase
        .from("contacts")
        .select("id")
        .eq("user_id", user.id)
        .eq("event", eventId);
      if (error) {
        showToast("Sync failed — check HubSpot connection", "error");
        return;
      }
      const contactIds = (rows || []).map((r) => r.id);
      if (contactIds.length === 0) {
        showToast("No contacts tagged to this event", "success");
        return;
      }
      const res = await fetch("/api/hubspot/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds, userId: user.id }),
      });
      const data = await res.json();
      if (res.status === 401 || data.error === "not_connected") {
        showToast("Sync failed — check HubSpot connection", "error");
        return;
      }
      if (!res.ok) {
        showToast("Sync failed — check HubSpot connection", "error");
        return;
      }
      const n = typeof data.succeeded === "number" ? data.succeeded : 0;
      if (n > 0) {
        showToast(`${n} contacts synced to HubSpot`, "success");
      } else {
        showToast("Sync failed — check HubSpot connection", "error");
      }
    } catch {
      showToast("Sync failed — check HubSpot connection", "error");
    } finally {
      setIsSyncingEvent(null);
    }
  };

  const parseCSV = (text: string): string[][] => {
    const results: string[][] = []
    const lines = text.split("\n")
    for (const line of lines) {
      if (!line.trim()) continue
      const row: string[] = []
      let cell = ""
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"' && !inQuotes) {
          inQuotes = true
        } else if (ch === '"' && inQuotes) {
          inQuotes = false
        } else if (ch === "," && !inQuotes) {
          row.push(cell.trim())
          cell = ""
        } else {
          cell += ch
        }
      }
      row.push(cell.trim())
      results.push(row)
    }
    return results
  }

  const openImportLeadListPicker = (eventId: string) => {
    setImportEventId(eventId);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleSaveLeadListSelected = async () => {
    if (!leadListResultsModal || !user?.id) return;
    const selectedRows = leadListResultsModal.contacts.filter((c) => selectedLeadListIds.includes(c.__id));
    if (!selectedRows.length) {
      showToast("No contacts selected", "error");
      return;
    }

    setIsSavingLeadList(true);
    let saved = 0;
    let failed = 0;

    for (const c of selectedRows) {
      const payload = {
        user_id: user.id,
        name: c.name || null,
        title: c.title || null,
        company: c.company || null,
        email: c.email || null,
        phone: c.phone || null,
        linkedin: c.linkedin || null,
        event: leadListResultsModal.eventId,
        lead_score: c.suggested_lead_score || 5,
        ai_enrichment: c.ai_enrichment || null,
        enriched: true,
        enriched_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("contacts").insert(payload);
      if (error) {
        failed += 1;
      } else {
        saved += 1;
      }
    }

    setIsSavingLeadList(false);
    if (saved > 0 && failed === 0) {
      showToast(`${saved} contacts saved to ${leadListResultsModal.eventName}`, "success");
    } else if (saved > 0 && failed > 0) {
      showToast(`${saved} saved, ${failed} failed — check for duplicate emails`, "error");
    } else {
      showToast("Enrichment failed — try again", "error");
    }

    if (saved > 0) {
      setLeadListResultsModal(null);
      setSelectedLeadListIds([]);
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (contactsData) {
        setContacts((contactsData as any[]) || []);
        setAllContacts(
          (contactsData as any[]).map((cc) => ({
            id: cc.id,
            name: cc.name,
            title: cc.title,
            company: cc.company,
            lead_score: cc.lead_score,
            email: cc.email,
            image: cc.image,
            event: cc.event,
          })) || []
        );
      }
      const { data: contactsByEvent } = await supabase
        .from("contacts")
        .select("id, event")
        .eq("user_id", user.id);
      if (contactsByEvent) setContactEventLinks((contactsByEvent as any[]) || []);
    }
  };

  const handleLeadListFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importEventId || !user?.id) return;

    const event = events.find((ev) => ev.id === importEventId);
    const eventName = event?.name || "event";

    try {
      setIsParsingListEvent(importEventId);
      const csvText = await file.text();
      const parsedRows = parseCSV(csvText);
      if (parsedRows.length < 2) {
        showToast("Could not parse this CSV — make sure it has name or email columns.", "error");
        return;
      }

      const total = Math.max(1, parsedRows.length - 1);
      setEnrichProgress({ open: true, progress: 2, current: 1, total, eventName });

      const expectedMs = total * 2000;
      const started = Date.now();
      const interval = window.setInterval(() => {
        const elapsed = Date.now() - started;
        const pct = Math.min(90, Math.max(2, Math.floor((elapsed / expectedMs) * 90)));
        const cur = Math.min(total, Math.max(1, Math.ceil((pct / 90) * total)));
        setEnrichProgress((prev) => ({ ...prev, progress: pct, current: cur }));
      }, 250);

      const controller = new AbortController();
      enrichAbortRef.current = controller;

      const res = await fetch("/api/enrich-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, userId: user.id, eventId: importEventId }),
        signal: controller.signal,
      });

      window.clearInterval(interval);
      enrichAbortRef.current = null;

      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error || "Enrichment failed — try again.", "error");
        setEnrichProgress({ open: false, progress: 0, current: 0, total: 0, eventName: "" });
        return;
      }

      const items = Array.isArray(data.contacts) ? data.contacts : [];
      if (!items.length) {
        showToast("Could not parse this CSV — make sure it has name or email columns.", "error");
        setEnrichProgress({ open: false, progress: 0, current: 0, total: 0, eventName: "" });
        return;
      }

      const sorted = [...items]
        .map((c: any, idx: number) => ({ ...c, __id: `${idx}-${(c.email || c.name || "lead").toString()}` }))
        .sort((a, b) => Number(b.icp_fit_score || 0) - Number(a.icp_fit_score || 0));
      const preselected = sorted
        .filter((c) => Number(c.icp_fit_score || 0) >= 6)
        .map((c) => c.__id);

      setLeadListResultsModal({ eventId: importEventId, eventName, contacts: sorted });
      setSelectedLeadListIds(preselected);
      setEnrichProgress({ open: false, progress: 0, current: 0, total: 0, eventName: "" });
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        showToast("Enrichment failed — try again.", "error");
      }
      setEnrichProgress({ open: false, progress: 0, current: 0, total: 0, eventName: "" });
      enrichAbortRef.current = null;
    } finally {
      setIsParsingListEvent(null);
      setImportEventId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const resetEvForm = () => {
    setEvForm({ name: "", date: "", type: "Conference", location: "", notes: "", attendees: [] });
  };

  const handleSaveEvent = async () => {
    if (!evForm.name.trim() || !user?.id) return;

    if (editingEvent) {
      const { data, error } = await supabase
        .from("events")
        .update({ ...evForm, attendees: [] })
        .eq("user_id", user.id)
        .eq("id", editingEvent)
        .select()
        .single();

      if (error) {
        showToast("Failed to update event", "error");
        return;
      }
      setEvents((prev) => prev.map((e) => (e.id === editingEvent ? { ...e, ...data } : e)));
      showToast("Event updated", "success");
    } else {
      const { data, error } = await supabase
        .from("events")
        .insert({ ...evForm, attendees: [], user_id: user.id })
        .select()
        .single();

      if (error || !data) {
        showToast("Failed to create event", "error");
        return;
      }
      setEvents((prev) => [data, ...prev]);
      showToast("Event created", "success");
    }
    setShowEventForm(false);
    setEditingEvent(null);
    resetEvForm();
  };

  const exportEventCsv = (eventName: string) => {
    const evContacts = contacts.filter((c) => c.event === eventName);
    if (evContacts.length === 0) {
      showToast("No contacts for this event yet", "success");
      return;
    }
    const headers = [
      "name", "title", "company", "email", "phone", "linkedin", "leadScore", "event", "date", "notes", "signals",
    ];
    const escapeCell = (value: any) => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const lines = [
      headers.join(","),
      ...evContacts.map((c) =>
        [
          escapeCell(c.name), escapeCell(c.title), escapeCell(c.company), escapeCell(c.email),
          escapeCell(c.phone), escapeCell(c.linkedin), escapeCell(c.leadScore), escapeCell(c.event),
          escapeCell(c.date), escapeCell(c.freeNote), escapeCell((c.checks || []).join("; ")),
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${eventName || "event"}-contacts.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!user) return <div className="min-h-screen bg-[#f7f7f5]" />;

  return (
    <div
      className="max-w-2xl mx-auto min-h-screen"
      style={{
        background: "#f7f7f5",
        padding: isMobile ? "20px 16px 100px" : "36px",
        overflowX: "hidden",
        maxWidth: "100vw",
        fontFamily: "Inter, -apple-system, sans-serif",
      }}
    >
      <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleLeadListFileChange} />
      <style>{`
        @keyframes eventsHubSpotSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 32,
            right: 32,
            zIndex: 9999,
            background: toast.variant === "error" ? "#e55a5a" : "#1a3a2a",
            color: "#ffffff",
            borderRadius: 10,
            padding: "12px 16px",
            fontSize: 14,
            fontWeight: 500,
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            maxWidth: "calc(100vw - 64px)",
          }}
        >
          {toast.message}
        </div>
      )}
      <div className="flex items-end justify-between mb-6" style={{ alignItems: "center" }}>
        <div>
          <h1
            style={{
              fontSize: isMobile ? 22 : 28,
              fontWeight: 700,
              color: "#111",
              letterSpacing: "-0.5px",
            }}
          >
            Events
          </h1>
          <p style={{ fontSize: 13, color: "#999", marginTop: 2 }}>
            {events.length} event{events.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isMobile && <button
            type="button"
            onClick={() => {
              const visibleIds = events.map((e) => e.id);
              const allSelected =
                visibleIds.length > 0 && visibleIds.every((id: string) => selectedIds.includes(id));
              if (allSelected) {
                setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
              } else {
                setSelectedIds(visibleIds);
              }
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#1a3a2a",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              padding: "8px 12px",
            }}
          >
            {(() => {
              const visibleIds = events.map((e) => e.id);
              const allSelected =
                visibleIds.length > 0 && visibleIds.every((id: string) => selectedIds.includes(id));
              return allSelected ? "Deselect all" : "Select all";
            })()}
          </button>}
          <button
            type="button"
            onClick={() => {
              resetEvForm();
              setEditingEvent(null);
              setShowEventForm(true);
            }}
            style={{
              background: "#1a3a2a",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + New Event
          </button>
        </div>
      </div>

      {showEventForm && (
        <div
          className="mb-5 space-y-4"
          style={{
            background: "#fff",
            border: "1px solid #ebebeb",
            borderRadius: 16,
            padding: "24px",
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#999",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {editingEvent ? "Edit Event" : "New Event"}
          </p>
          <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block" style={{ fontSize: 13 }}>Event name *</label>
              <input
                type="text"
                value={evForm.name}
                onChange={(e) => setEvForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. SaaStr Annual 2026"
                className="w-full text-sm text-slate-900 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 bg-slate-50"
                style={{ fontFamily: "Georgia, serif", color: "black", height: isMobile ? 44 : undefined }}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block" style={{ fontSize: 13 }}>Date</label>
              <input
                type="date"
                value={evForm.date}
                onChange={(e) => setEvForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full text-sm text-slate-900 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 bg-slate-50"
                style={{ fontFamily: "Georgia, serif", color: "black", height: isMobile ? 44 : undefined }}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block" style={{ fontSize: 13 }}>Type</label>
              <select
                value={evForm.type}
                onChange={(e) => setEvForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full text-sm text-slate-900 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 bg-slate-50"
                style={{ fontFamily: "Georgia, serif", color: "black", height: isMobile ? 44 : undefined }}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block" style={{ fontSize: 13 }}>Location</label>
              <input
                type="text"
                value={evForm.location}
                onChange={(e) => setEvForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. San Francisco, CA"
                className="w-full text-sm text-slate-900 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 bg-slate-50"
                style={{ fontFamily: "Georgia, serif", color: "black", height: isMobile ? 44 : undefined }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block" style={{ fontSize: 13 }}>Notes</label>
            <textarea
              value={evForm.notes}
              onChange={(e) => setEvForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Goals, context, booth number..."
              rows={2}
              className="w-full text-sm text-slate-900 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 bg-slate-50 resize-none"
              style={{ fontFamily: "Georgia, serif", color: "black", minHeight: isMobile ? 44 : undefined }}
            />
          </div>
          <div className="flex gap-2 pt-1" style={{ flexDirection: isMobile ? "column" : "row" }}>
            <button
              onClick={handleSaveEvent}
              className="flex-1 rounded-full border border-[#1a3a2a] bg-[#f0f0ec] py-2.5 text-sm font-medium text-[#1a2e1a] hover:bg-[#f7faf4] hover:text-[#1a2e1a] transition-colors"
              style={{ width: isMobile ? "100%" : undefined, height: isMobile ? 48 : undefined }}
            >
              {editingEvent ? "Save Changes" : "Create Event"}
            </button>
            <button
              onClick={() => {
                setShowEventForm(false);
                setEditingEvent(null);
                resetEvForm();
              }}
              className="px-4 py-2.5 border border-slate-200 text-sm text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
              style={{ width: isMobile ? "100%" : undefined, height: isMobile ? 48 : undefined }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && !showEventForm && (
        <div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                border: "1px solid #ebebeb",
                borderRadius: 14,
                padding: 20,
                marginBottom: 12,
              }}
            >
              <div
                className="skeleton"
                style={{ width: 180, height: 16, borderRadius: 4 }}
              />
              <div
                className="skeleton"
                style={{ width: 120, height: 12, borderRadius: 4, marginTop: 8 }}
              />
            </div>
          ))}
        </div>
      )}

      {!loading && events.length === 0 && !showEventForm && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #ebebeb",
            borderRadius: 16,
            padding: "48px 24px",
            textAlign: "center",
            color: "#bbb",
            fontSize: 14,
          }}
        >
          No events yet — create your first one
          <button
            type="button"
            onClick={() => {
              resetEvForm();
              setShowEventForm(true);
            }}
            style={{
              display: "block",
              margin: "16px auto 0",
              background: "#7dde3c",
              color: "#0a1a0a",
              border: "none",
              borderRadius: "10px",
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Create first event
          </button>
        </div>
      )}

      {!loading && !isMobile && (
        <div
          style={{
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #ebebeb",
            overflow: "hidden",
            width: "100%",
            marginTop: "24px",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "1px solid #ebebeb" }}>
                <th style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#999", padding: "10px 16px", textAlign: "left" }}>
                  Event Name
                </th>
                <th style={{ width: 140, fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#999", padding: "10px 16px", textAlign: "left" }}>
                  Date
                </th>
                <th style={{ width: 160, fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#999", padding: "10px 16px", textAlign: "left" }}>
                  Location
                </th>
                <th style={{ width: 120, fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#999", padding: "10px 16px", textAlign: "left" }}>
                  Type
                </th>
                <th style={{ width: 100, fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#999", padding: "10px 16px", textAlign: "center" }}>
                  Contacts
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const evContacts = contacts.filter((c) => c.event === ev.id);
                const hotCount = evContacts.filter((c) => c.leadScore >= 3).length;
                const isSelected = selectedIds.includes(ev.id);
                return (
                  <Fragment key={ev.id}>
                    <tr
                      onClick={() => setExpandedEventId(expandedEventId === ev.id ? null : ev.id)}
                      style={{
                        borderBottom: "1px solid #f5f5f5",
                        transition: "background 0.1s ease",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#fafafa";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#fff";
                      }}
                    >
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedIds((prev) =>
                                prev.includes(ev.id) ? prev.filter((id) => id !== ev.id) : [...prev, ev.id]
                              );
                            }}
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              border: "1.5px solid #dddddd",
                              background: isSelected ? "#7dde3c" : "#ffffff",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {isSelected && (
                              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>{ev.name}</div>
                            {ev.notes ? (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#999",
                                  marginTop: 2,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {ev.notes}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#555", verticalAlign: "middle" }}>
                        {ev.date
                          ? new Date(ev.date + "T00:00:00").toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#555", verticalAlign: "middle" }}>
                        {ev.location || "—"}
                      </td>
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        <span
                          style={{
                            background: "#f5f5f5",
                            borderRadius: "999px",
                            padding: "2px 10px",
                            fontSize: "12px",
                            color: "#555",
                            textTransform: "capitalize",
                          }}
                        >
                          {(ev.type || "event").toString()}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center", verticalAlign: "middle" }}>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>{getContactCount(ev.id)}</div>
                        <div style={{ fontSize: "11px", color: "#999" }}>contacts</div>
                      </td>
                    </tr>
                    {expandedEventId === ev.id && (
                      <tr>
                        <td colSpan={5} style={{ padding: "0 16px 16px", borderBottom: "1px solid #f5f5f5" }}>
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setEvForm({
                                    name: ev.name,
                                    date: ev.date || "",
                                    type: ev.type || "Conference",
                                    location: ev.location || "",
                                    notes: ev.notes || "",
                                    attendees: ev.attendees || [],
                                  });
                                  setEditingEvent(ev.id);
                                  setShowEventForm(true);
                                }}
                                style={{
                                  background: "#f5f5f5",
                                  color: "#111",
                                  border: "none",
                                  borderRadius: 8,
                                  padding: "7px 14px",
                                  fontSize: 13,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => exportEventCsv(ev.name)}
                                style={{
                                  background: "#f5f5f5",
                                  color: "#111",
                                  border: "none",
                                  borderRadius: 8,
                                  padding: "7px 14px",
                                  fontSize: 13,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                }}
                              >
                                Export CSV
                              </button>
                              <button
                                type="button"
                                disabled={isSyncingEvent === ev.id}
                                onClick={() => void syncEventToHubSpot(ev.id)}
                                style={{
                                  background: "#fff3ee",
                                  border: "1px solid #ffd4c2",
                                  color: "#ff7a59",
                                  borderRadius: 8,
                                  padding: "8px 14px",
                                  fontSize: 13,
                                  fontWeight: 500,
                                  cursor: isSyncingEvent === ev.id ? "default" : "pointer",
                                  opacity: isSyncingEvent === ev.id ? 0.85 : 1,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                {isSyncingEvent === ev.id ? (
                                  <>
                                    <span
                                      style={{
                                        width: 14,
                                        height: 14,
                                        border: "2px solid #ffd4c2",
                                        borderTopColor: "#ff7a59",
                                        borderRadius: "50%",
                                        animation: "eventsHubSpotSpin 0.8s linear infinite",
                                        flexShrink: 0,
                                      }}
                                    />
                                    Syncing...
                                  </>
                                ) : (
                                  <>H  Sync to HubSpot</>
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={isParsingListEvent === ev.id}
                                onClick={() => openImportLeadListPicker(ev.id)}
                                style={{
                                  background: "#fff",
                                  border: "1px solid #e8e8e8",
                                  color: "#111",
                                  borderRadius: 8,
                                  padding: "8px 14px",
                                  fontSize: 13,
                                  fontWeight: 500,
                                  cursor: isParsingListEvent === ev.id ? "default" : "pointer",
                                  opacity: isParsingListEvent === ev.id ? 0.85 : 1,
                                }}
                              >
                                {isParsingListEvent === ev.id ? "Parsing list..." : "Import lead list"}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const { error } = await supabase.from("events").delete().eq("id", ev.id);
                                  if (error) {
                                    console.error("Delete event error:", error);
                                    return;
                                  }
                                  setEvents((prev) => prev.filter((e) => e.id !== ev.id));
                                  setSelectedIds((prev) => prev.filter((id) => id !== ev.id));
                                  showToast("Event deleted", "success");
                                }}
                                style={{
                                  background: "#ffffff",
                                  border: "1px solid #fde8e8",
                                  color: "#e55a5a",
                                  borderRadius: 8,
                                  padding: "6px 14px",
                                  fontSize: 13,
                                  cursor: "pointer",
                                }}
                              >
                                Delete
                              </button>
                            </div>
                            {(() => {
                              const eventContacts = allContacts.filter((c) => c.event === ev.id);
                              if (eventContacts.length === 0) {
                                return <div style={{ fontSize: 13, color: "#bbb", padding: "12px 0" }}>No contacts tagged to this event yet.</div>;
                              }
                              return (
                                <div>
                                  {eventContacts.map((c) => {
                                    const score = Number(c.lead_score || 0);
                                    const badgeStyle =
                                      score >= 7
                                        ? { background: "#f0f7eb", color: "#2d6a1f" }
                                        : score >= 4
                                        ? { background: "#fff3eb", color: "#b07020" }
                                        : { background: "#fde8e8", color: "#e55a5a" };
                                    return (
                                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f7f7f7" }}>
                                        {c.image ? (
                                          <img src={c.image} alt={c.name || "Contact"} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                                        ) : (
                                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f0f7eb", color: "#2d6a1f", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            {(c.name || "?").toString().trim().charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{c.name || "Unknown contact"}</div>
                                          <div style={{ fontSize: 12, color: "#999" }}>{[c.title, c.company].filter(Boolean).join(" · ") || "—"}</div>
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, ...badgeStyle }}>{score}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                              <span style={{ fontSize: 13, color: "#999" }}>
                                {evContacts.length} contact{evContacts.length !== 1 ? "s" : ""}
                              </span>
                              {hotCount > 0 && (
                                <span style={{ fontSize: 13, color: "#666" }}>
                                  {hotCount} hot lead{hotCount > 1 ? "s" : ""}
                                </span>
                              )}
                              {ev.attendees?.length > 0 && (
                                <span style={{ fontSize: 13, color: "#666" }}>{ev.attendees.length} tagged</span>
                              )}
                            </div>
                            {ev.attendees?.length > 0 && (
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {ev.attendees.map((a: string) => (
                                    <span
                                      key={a}
                                      style={{
                                        background: "#f0f7eb",
                                        color: "#2d6a1f",
                                        borderRadius: 999,
                                        fontSize: 12,
                                        padding: "3px 10px",
                                      }}
                                    >
                                      {a}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {ev.notes && (
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
                                <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5, margin: 0 }}>{ev.notes}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && isMobile && (
      <div>
        {events.map((ev) => {
          const evContacts = contacts.filter((c) => c.event === ev.id);
          const hotCount = evContacts.filter((c) => c.leadScore >= 3).length;
          const isSelected = selectedIds.includes(ev.id);
          return (
            <div
              key={ev.id}
              style={{
                background: "#fff",
                border: "1px solid #ebebeb",
                borderRadius: isMobile ? 14 : 16,
                padding: isMobile ? "16px" : "20px 24px",
                marginBottom: 12,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#d0e8c0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#ebebeb";
              }}
            >
              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 12 }}>
                <div
                  onClick={() => setExpandedEventId(expandedEventId === ev.id ? null : ev.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, cursor: "pointer" }}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIds((prev) =>
                        prev.includes(ev.id) ? prev.filter((id) => id !== ev.id) : [...prev, ev.id]
                      );
                    }}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      border: "1.5px solid #dddddd",
                      background: isSelected ? "#7dde3c" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && (
                      <svg
                        width="12"
                        height="12"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="white"
                        strokeWidth="3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: "#111", whiteSpace: "normal", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.name}</span>
                      {ev.type && (
                        <span
                          style={{
                            background: "#f0f7eb",
                            color: "#2d6a1f",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 500,
                            padding: "3px 10px",
                            marginLeft: 10,
                          }}
                        >
                          {ev.type}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                      {ev.date && (
                        <>
                          {new Date(ev.date + "T00:00:00").toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </>
                      )}
                      {ev.date && ev.location ? " · " : ""}
                      {ev.location && <>{ev.location}</>}
                    </div>
                  </div>
                  <span
                    style={{
                      marginLeft: "auto",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#bbb",
                      transition: "transform 0.2s ease",
                      transform: expandedEventId === ev.id ? "rotate(180deg)" : "rotate(0deg)",
                      flexShrink: 0,
                    }}
                  >
                    <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="#bbb" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 8, marginTop: isMobile ? 4 : 0, flexWrap: isMobile ? "wrap" : "nowrap" }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEvForm({
                        name: ev.name,
                        date: ev.date || "",
                        type: ev.type || "Conference",
                        location: ev.location || "",
                        notes: ev.notes || "",
                        attendees: ev.attendees || [],
                      });
                      setEditingEvent(ev.id);
                      setShowEventForm(true);
                    }}
                    style={{
                      background: "#f5f5f5",
                      color: "#111",
                      border: "none",
                      borderRadius: 8,
                      padding: isMobile ? "6px 10px" : "7px 14px",
                      fontSize: isMobile ? 12 : 13,
                      height: isMobile ? 34 : undefined,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportEventCsv(ev.name);
                    }}
                    style={{
                      background: "#f5f5f5",
                      color: "#111",
                      border: "none",
                      borderRadius: 8,
                      padding: isMobile ? "6px 10px" : "7px 14px",
                      fontSize: isMobile ? 12 : 13,
                      height: isMobile ? 34 : undefined,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    disabled={isSyncingEvent === ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void syncEventToHubSpot(ev.id);
                    }}
                    style={{
                      background: "#fff3ee",
                      border: "1px solid #ffd4c2",
                      color: "#ff7a59",
                      borderRadius: 8,
                      padding: isMobile ? "6px 10px" : "8px 14px",
                      fontSize: isMobile ? 12 : 13,
                      height: isMobile ? 34 : undefined,
                      fontWeight: 500,
                      cursor: isSyncingEvent === ev.id ? "default" : "pointer",
                      opacity: isSyncingEvent === ev.id ? 0.85 : 1,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {isSyncingEvent === ev.id ? (
                      <>
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            border: "2px solid #ffd4c2",
                            borderTopColor: "#ff7a59",
                            borderRadius: "50%",
                            animation: "eventsHubSpotSpin 0.8s linear infinite",
                            flexShrink: 0,
                          }}
                        />
                        Syncing...
                      </>
                    ) : (
                      <>H  Sync to HubSpot</>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isParsingListEvent === ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      openImportLeadListPicker(ev.id);
                    }}
                    style={{
                      background: "#fff",
                      border: "1px solid #e8e8e8",
                      color: "#111",
                      borderRadius: 8,
                      padding: isMobile ? "6px 10px" : "8px 14px",
                      fontSize: isMobile ? 12 : 13,
                      height: isMobile ? 34 : undefined,
                      fontWeight: 500,
                      cursor: isParsingListEvent === ev.id ? "default" : "pointer",
                      opacity: isParsingListEvent === ev.id ? 0.85 : 1,
                    }}
                  >
                    {isParsingListEvent === ev.id ? "Parsing list..." : "Import lead list"}
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const { error } = await supabase.from("events").delete().eq("id", ev.id);
                      if (error) {
                        console.error("Delete event error:", error);
                        return;
                      }
                      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
                      setSelectedIds((prev) => prev.filter((id) => id !== ev.id));
                      showToast("Event deleted", "success");
                    }}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #fde8e8",
                      color: "#e55a5a",
                      borderRadius: 8,
                      padding: isMobile ? "6px 10px" : "6px 14px",
                      fontSize: isMobile ? 12 : 13,
                      height: isMobile ? 34 : undefined,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 13, color: "#999" }}>
                  {getContactCount(ev.id)} contact{getContactCount(ev.id) !== 1 ? "s" : ""}
                </span>
                {hotCount > 0 && (
                  <span
                    style={{
                      fontSize: 13,
                      color: "#666",
                    }}
                  >
                    {hotCount} hot lead{hotCount > 1 ? "s" : ""}
                  </span>
                )}
                {ev.attendees?.length > 0 && (
                  <span style={{ fontSize: 13, color: "#666" }}>{ev.attendees.length} tagged</span>
                )}
                {ev.attendees?.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {(ev.attendees as string[]).slice(0, 4).map((att: string) => (
                      <span
                        key={att}
                        style={{
                          background: "#f0f7eb",
                          color: "#2d6a1f",
                          borderRadius: 999,
                          padding: "4px 12px",
                          fontSize: 13,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {att}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {expandedEventId === ev.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
                  {(() => {
                    const eventContacts = allContacts.filter((c) => c.event === ev.id);
                    if (eventContacts.length === 0) {
                      return <div style={{ fontSize: 13, color: "#bbb", padding: "12px 0" }}>No contacts tagged to this event yet.</div>;
                    }
                    return (
                      <div>
                        {eventContacts.map((c) => {
                          const score = Number(c.lead_score || 0);
                          const badgeStyle =
                            score >= 7
                              ? { background: "#f0f7eb", color: "#2d6a1f" }
                              : score >= 4
                              ? { background: "#fff3eb", color: "#b07020" }
                              : { background: "#fde8e8", color: "#e55a5a" };
                          return (
                            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f7f7f7" }}>
                              {c.image ? (
                                <img src={c.image} alt={c.name || "Contact"} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                              ) : (
                                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f0f7eb", color: "#2d6a1f", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  {(c.name || "?").toString().trim().charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{c.name || "Unknown contact"}</div>
                                <div style={{ fontSize: 12, color: "#999" }}>{[c.title, c.company].filter(Boolean).join(" · ") || "—"}</div>
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, ...badgeStyle }}>{score}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
              {ev.attendees?.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ev.attendees.map((a: string) => (
                      <span
                        key={a}
                        style={{
                          background: "#f0f7eb",
                          color: "#2d6a1f",
                          borderRadius: 999,
                          fontSize: 12,
                          padding: "3px 10px",
                        }}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {ev.notes && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
                  <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5, margin: 0 }}>{ev.notes}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {enrichProgress.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 40,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: 640,
              maxWidth: "95vw",
              padding: "24px 24px 20px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111" }}>Enriching lead list...</h3>
            <p style={{ margin: "8px 0 14px", fontSize: 13, color: "#666" }}>
              Scoring contact {Math.min(enrichProgress.current, enrichProgress.total)} of {enrichProgress.total} against your ICP...
            </p>
            <div style={{ height: 10, background: "#eef2ee", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${enrichProgress.progress}%`,
                  background: "linear-gradient(90deg, #1a3a2a 0%, #7dde3c 100%)",
                  transition: "width 0.25s ease",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                onClick={() => {
                  enrichAbortRef.current?.abort();
                  enrichAbortRef.current = null;
                  setEnrichProgress({ open: false, progress: 0, current: 0, total: 0, eventName: "" });
                  setIsParsingListEvent(null);
                }}
                style={{
                  background: "#fff",
                  border: "1px solid #e8e8e8",
                  color: "#666",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {leadListResultsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 40,
          }}
          onClick={() => {
            if (!isSavingLeadList) setLeadListResultsModal(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: 800,
              maxWidth: "95vw",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #ebebeb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#111" }}>Lead List Results</div>
                  <div style={{ fontSize: 13, color: "#999", marginTop: 4 }}>
                    {leadListResultsModal.contacts.length} contacts enriched from {leadListResultsModal.eventName} — select which to save
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 13, color: "#666" }}>
                    {selectedLeadListIds.length} of {leadListResultsModal.contacts.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedLeadListIds(leadListResultsModal.contacts.map((c) => c.__id))}
                    style={{
                      color: "#1a3a2a",
                      fontSize: 13,
                      cursor: "pointer",
                      background: "transparent",
                      border: "none",
                    }}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveLeadListSelected()}
                    disabled={isSavingLeadList}
                    style={{
                      background: "#1a3a2a",
                      color: "#fff",
                      borderRadius: 10,
                      padding: "10px 20px",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isSavingLeadList ? "default" : "pointer",
                      border: "none",
                      opacity: isSavingLeadList ? 0.75 : 1,
                    }}
                  >
                    {isSavingLeadList ? "Saving..." : "Save selected"}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {leadListResultsModal.contacts.map((c) => {
                const checked = selectedLeadListIds.includes(c.__id);
                const score = Number(c.icp_fit_score || 0);
                const colors =
                  score >= 7
                    ? { fg: "#2d6a1f", bg: "#f0f7eb" }
                    : score >= 4
                      ? { fg: "#b07020", bg: "#fff3eb" }
                      : { fg: "#e55a5a", bg: "#fde8e8" };
                return (
                  <div
                    key={c.__id}
                    onClick={() => {
                      setSelectedLeadListIds((prev) =>
                        prev.includes(c.__id) ? prev.filter((id) => id !== c.__id) : [...prev, c.__id]
                      );
                    }}
                    style={{
                      padding: "14px 20px",
                      borderBottom: "1px solid #f5f5f5",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: checked ? "1.5px solid #1a3a2a" : "1.5px solid #d0d0d0",
                        background: checked ? "#1a3a2a" : "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {checked ? (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden>
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{c.name || "Unknown contact"}</div>
                      <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{[c.title, c.company].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: colors.bg,
                          color: colors.fg,
                        }}
                      >
                        ICP {score || 0}/10
                      </span>
                      <div style={{ fontSize: 11, color: "#999", maxWidth: 200, textAlign: "right", marginTop: 4 }}>
                        {c.icp_fit_reason || ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(20, 20, 20, 0.75)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 999,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            zIndex: 50,
          }}
        >
          <span
            style={{
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              paddingRight: 4,
            }}
          >
            {selectedIds.length} selected
          </span>
          <button
            type="button"
            onClick={() => {
              const selectedEvents = events.filter((e) => selectedIds.includes(e.id));
              if (!selectedEvents.length) return;
              const header = ["name", "date", "type", "location", "attendees"];
              const rows = selectedEvents.map((e) => [
                e.name ?? "",
                e.date ?? "",
                e.type ?? "",
                e.location ?? "",
                Array.isArray(e.attendees) ? e.attendees.length : 0,
              ]);
              const csvContent = [header, ...rows]
                .map((row) =>
                  row
                    .map((value) => {
                      const str = String(value ?? "");
                      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                        return `"${str.replace(/"/g, '""')}"`;
                      }
                      return str;
                    })
                    .join(",")
                )
                .join("\n");
              const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.setAttribute("download", "katch-events-export.csv");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
            style={{
              background: "rgba(255,255,255,0.1)",
              color: "#ffffff",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 999,
              padding: "8px 18px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={async () => {
              const ids = [...selectedIds];
              if (!ids.length) return;
              const { error } = await supabase.from("events").delete().in("id", ids);
              if (error) {
                console.error("Bulk delete events error:", error);
                return;
              }
              setEvents((prev) => prev.filter((e) => !ids.includes(e.id)));
              setSelectedIds([]);
              showToast(`${ids.length} events deleted`, "success");
            }}
            style={{
              background: "rgba(229,90,90,0.15)",
              color: "#e55a5a",
              border: "1px solid rgba(229,90,90,0.2)",
              borderRadius: 999,
              padding: "8px 18px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
