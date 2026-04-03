"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { EVENT_TYPES } from "@/lib/katch-constants";

function getEventThumbnailSrc(type: string | null | undefined): string {
  const t = String(type ?? "").trim();
  if (t === "Conference") return "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=300&q=80";
  if (t === "Trade Show") return "https://images.unsplash.com/photo-1559223607-b4d0555ae227?w=300&q=80";
  return "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=300&q=80";
}

const EVENT_FORM_FIELD_CLASS =
  "w-full box-border border border-[#e8e8e8] rounded-[8px] bg-white px-[14px] py-[10px] text-[14px] text-[#111] outline-none focus:border-[#1a3a2a]";

function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmdToLocalDate(raw: string): Date | null {
  if (!raw) return null;
  const ymd = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

/** Single card shadow level for event list cards (keep in sync with `--app-card-shadow` in globals.css). */
const EVENT_CARD_SHADOW = "0 1px 3px rgba(0,0,0,0.08)";

function getEventScheduleStatus(dateStr: string | null | undefined): "upcoming" | "past" | "none" {
  const parsed = parseYmdToLocalDate((dateStr || "").slice(0, 10));
  if (!parsed) return "none";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const evDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return evDay.getTime() < startToday.getTime() ? "past" : "upcoming";
}

function formatEventFormDisplayDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isTodayDate(d: Date): boolean {
  return isSameCalendarDay(d, new Date());
}

function getCalendarGridCells(viewYear: number, viewMonth: number) {
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const nDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevN = new Date(viewYear, viewMonth, 0).getDate();
  const cells: { label: number; inCurrentMonth: boolean; date: Date }[] = [];
  for (let i = 0; i < firstDow; i++) {
    const day = prevN - firstDow + i + 1;
    cells.push({ label: day, inCurrentMonth: false, date: new Date(viewYear, viewMonth - 1, day) });
  }
  for (let day = 1; day <= nDays; day++) {
    cells.push({ label: day, inCurrentMonth: true, date: new Date(viewYear, viewMonth, day) });
  }
  let n = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ label: n, inCurrentMonth: false, date: new Date(viewYear, viewMonth + 1, n) });
    n++;
  }
  return cells;
}

export default function EventsPage() {
  const router = useRouter();
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
  const [openEventMenuId, setOpenEventMenuId] = useState<string | null>(null);
  const eventMenuWrapperRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [eventFormSelectedDate, setEventFormSelectedDate] = useState<Date | null>(null);
  const [eventFormDateError, setEventFormDateError] = useState(false);
  const [eventFormCalendarOpen, setEventFormCalendarOpen] = useState(false);
  const [eventFormCalendarView, setEventFormCalendarView] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const eventDatePickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showEventForm) return;
    const d = evForm.date ? parseYmdToLocalDate(evForm.date) : null;
    setEventFormSelectedDate(d);
  }, [showEventForm, editingEvent, evForm.date]);

  useEffect(() => {
    if (!eventFormCalendarOpen) return;
    const onDown = (e: MouseEvent) => {
      if (eventDatePickerRef.current && !eventDatePickerRef.current.contains(e.target as Node)) {
        setEventFormCalendarOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [eventFormCalendarOpen]);

  useEffect(() => {
    if (openEventMenuId === null) return;
    const onMouseDown = (e: MouseEvent) => {
      const el = eventMenuWrapperRefs.current[openEventMenuId];
      if (el && !el.contains(e.target as Node)) {
        setOpenEventMenuId(null);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [openEventMenuId]);

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
    setEventFormSelectedDate(null);
    setEventFormDateError(false);
    setEventFormCalendarOpen(false);
    const n = new Date();
    setEventFormCalendarView({ year: n.getFullYear(), month: n.getMonth() });
  };

  const handleSaveEvent = async () => {
    if (!evForm.name.trim() || !user?.id) return;

    const dateStr = eventFormSelectedDate ? toYmdLocal(eventFormSelectedDate) : "";
    if (!dateStr) {
      setEventFormDateError(true);
      return;
    }
    setEventFormDateError(false);

    if (editingEvent) {
      const { data, error } = await supabase
        .from("events")
        .update({ ...evForm, date: dateStr, attendees: [] })
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
        .insert({ ...evForm, date: dateStr, attendees: [], user_id: user.id })
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

  const eventCardMenuPanelStyle: CSSProperties = {
    position: "absolute",
    right: 0,
    top: "100%",
    zIndex: 50,
    minWidth: 180,
    padding: 4,
    background: "#fff",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  };

  const eventCardMenuItemBase: CSSProperties = {
    width: "100%",
    padding: "7px 12px",
    fontSize: 13,
    cursor: "pointer",
    borderRadius: 6,
    border: "none",
    background: "transparent",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxSizing: "border-box",
    color: "#111",
  };

  const renderEventOverflowMenu = (ev: any, showImportLeadList = false) => (
    <div
      ref={(el) => {
        eventMenuWrapperRefs.current[ev.id] = el;
      }}
      style={{ position: "relative", flexShrink: 0 }}
    >
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={openEventMenuId === ev.id}
        onClick={(e) => {
          e.stopPropagation();
          setOpenEventMenuId((id) => (id === ev.id ? null : ev.id));
        }}
        style={{
          background: openEventMenuId === ev.id ? "#e8e8e8" : "transparent",
          border: "none",
          borderRadius: 6,
          padding: "6px 8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          if (openEventMenuId !== ev.id) e.currentTarget.style.background = "#f0f0f0";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = openEventMenuId === ev.id ? "#e8e8e8" : "transparent";
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="3" cy="8" r="1.5" fill="#666" />
          <circle cx="8" cy="8" r="1.5" fill="#666" />
          <circle cx="13" cy="8" r="1.5" fill="#666" />
        </svg>
      </button>
      {openEventMenuId === ev.id && (
        <div role="menu" style={eventCardMenuPanelStyle} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpenEventMenuId(null);
              router.push("/contacts?event=" + ev.id);
            }}
            style={eventCardMenuItemBase}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f5f5f5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            View Contacts
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpenEventMenuId(null);
              router.push("/sequences?event=" + ev.id);
            }}
            style={eventCardMenuItemBase}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f5f5f5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Generate Sequences
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpenEventMenuId(null);
              setEvForm({
                name: ev.name,
                date: ev.date || "",
                type: ev.type || "Conference",
                location: ev.location || "",
                notes: ev.notes || "",
                attendees: ev.attendees || [],
              });
              setEventFormDateError(false);
              setEditingEvent(ev.id);
              setShowEventForm(true);
            }}
            style={eventCardMenuItemBase}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f5f5f5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              setOpenEventMenuId(null);
              exportEventCsv(ev.name);
            }}
            style={eventCardMenuItemBase}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f5f5f5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Export CSV
          </button>
          {showImportLeadList ? (
            <button
              type="button"
              role="menuitem"
              disabled={isParsingListEvent === ev.id}
              onClick={(e) => {
                e.stopPropagation();
                setOpenEventMenuId(null);
                openImportLeadListPicker(ev.id);
              }}
              style={{
                ...eventCardMenuItemBase,
                opacity: isParsingListEvent === ev.id ? 0.85 : 1,
                cursor: isParsingListEvent === ev.id ? "default" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (isParsingListEvent !== ev.id) e.currentTarget.style.background = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {isParsingListEvent === ev.id ? "Parsing list..." : "Import lead list"}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={isSyncingEvent === ev.id}
            onClick={(e) => {
              e.stopPropagation();
              setOpenEventMenuId(null);
              void syncEventToHubSpot(ev.id);
            }}
            style={{
              ...eventCardMenuItemBase,
              color: "#ff7a59",
              opacity: isSyncingEvent === ev.id ? 0.85 : 1,
              cursor: isSyncingEvent === ev.id ? "default" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (isSyncingEvent !== ev.id) e.currentTarget.style.background = "#f5f5f5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
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
              "Sync to HubSpot"
            )}
          </button>
          <div style={{ margin: "4px 0", borderTop: "1px solid #f0f0f0" }} />
          <button
            type="button"
            role="menuitem"
            onClick={async (e) => {
              e.stopPropagation();
              setOpenEventMenuId(null);
              const { error } = await supabase.from("events").delete().eq("id", ev.id);
              if (error) {
                console.error("Delete event error:", error);
                return;
              }
              setEvents((prev) => prev.filter((row) => row.id !== ev.id));
              setSelectedIds((prev) => prev.filter((id) => id !== ev.id));
              showToast("Event deleted", "success");
            }}
            style={{ ...eventCardMenuItemBase, color: "#e55a5a" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f5f5f5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );

  if (!user) return <div className="min-h-screen bg-[#f7f7f5]" />;

  return (
    <div
      className="max-w-2xl mx-auto min-h-screen"
      style={{
        background: "#f7f7f5",
        padding: isMobile ? "24px 24px 100px" : "24px 24px",
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
            boxShadow: EVENT_CARD_SHADOW,
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
              fontSize: 24,
              fontWeight: 700,
              color: "#111",
              margin: 0,
            }}
          >
            Events
          </h1>
          <p style={{ fontSize: 13, color: "#999", marginTop: 2 }}>
            {events.length} event{events.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
              <label className="text-xs mb-1 block" style={{ fontSize: 13, color: "#111" }}>
                Event name <span style={{ color: "#e55a5a" }}>*</span>
              </label>
              <input
                type="text"
                value={evForm.name}
                onChange={(e) => setEvForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. SaaStr Annual 2026"
                className={EVENT_FORM_FIELD_CLASS}
                style={{ fontFamily: "Inter, sans-serif", height: isMobile ? 44 : undefined }}
              />
            </div>
            <div
              className="col-span-2"
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 3fr) minmax(0, 2fr)",
                gap: 12,
                alignItems: "start",
              }}
            >
            <div ref={eventDatePickerRef} style={{ position: "relative", minWidth: 0 }}>
              <label className="text-xs mb-1 block" style={{ fontSize: 13, color: "#111" }}>
                Date <span style={{ color: "#e55a5a" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  readOnly
                  value={eventFormSelectedDate ? formatEventFormDisplayDate(eventFormSelectedDate) : ""}
                  placeholder="Select a date"
                  onClick={() => {
                    setEventFormCalendarOpen((prev) => {
                      const next = !prev;
                      if (next) {
                        const base = eventFormSelectedDate ?? new Date();
                        setEventFormCalendarView({ year: base.getFullYear(), month: base.getMonth() });
                      }
                      return next;
                    });
                  }}
                  className={EVENT_FORM_FIELD_CLASS}
                  style={{
                    fontFamily: "Inter, sans-serif",
                    height: isMobile ? 44 : undefined,
                    paddingRight: 44,
                    cursor: "pointer",
                  }}
                />
                <button
                  type="button"
                  aria-label="Open calendar"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEventFormCalendarOpen((prev) => {
                      const next = !prev;
                      if (next) {
                        const base = eventFormSelectedDate ?? new Date();
                        setEventFormCalendarView({ year: base.getFullYear(), month: base.getMonth() });
                      }
                      return next;
                    });
                  }}
                  style={{
                    position: "absolute",
                    right: 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: "4px 8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#999",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                  </svg>
                </button>
              </div>
              {eventFormDateError ? (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#e55a5a" }}>Date is required</p>
              ) : null}
              {eventFormCalendarOpen &&
                (() => {
                  const { year: vy, month: vm } = eventFormCalendarView;
                  const headerLabel = new Date(vy, vm, 1).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  });
                  const cells = getCalendarGridCells(vy, vm);
                  return (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: "100%",
                        marginTop: 8,
                        width: 280,
                        zIndex: 100,
                        background: "#fff",
                        borderRadius: 12,
                        border: "1px solid #ebebeb",
                        boxShadow: EVENT_CARD_SHADOW,
                        padding: 16,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                        <button
                          type="button"
                          aria-label="Previous month"
                          onClick={() => {
                            setEventFormCalendarView((v) => {
                              let m = v.month - 1;
                              let y = v.year;
                              if (m < 0) {
                                m = 11;
                                y -= 1;
                              }
                              return { year: y, month: m };
                            });
                          }}
                          style={{ color: "#999", cursor: "pointer", padding: "4px 8px", background: "none", border: "none" }}
                        >
                          &lt;
                        </button>
                        <div style={{ flex: 1, textAlign: "center", fontWeight: 600, fontSize: 14, color: "#111" }}>
                          {headerLabel}
                        </div>
                        <button
                          type="button"
                          aria-label="Next month"
                          onClick={() => {
                            setEventFormCalendarView((v) => {
                              let m = v.month + 1;
                              let y = v.year;
                              if (m > 11) {
                                m = 0;
                                y += 1;
                              }
                              return { year: y, month: m };
                            });
                          }}
                          style={{ color: "#999", cursor: "pointer", padding: "4px 8px", background: "none", border: "none" }}
                        >
                          &gt;
                        </button>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(7, 1fr)",
                          marginBottom: 8,
                        }}
                      >
                        {["S", "M", "T", "W", "T", "F", "S"].map((l, i) => (
                          <div key={`${l}-${i}`} style={{ fontSize: 11, color: "#999", textAlign: "center" }}>
                            {l}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                        {cells.map((cell, idx) => {
                          const selected =
                            eventFormSelectedDate != null && isSameCalendarDay(cell.date, eventFormSelectedDate);
                          const today = !selected && isTodayDate(cell.date);
                          return (
                            <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const ymd = toYmdLocal(cell.date);
                                  setEventFormSelectedDate(cell.date);
                                  setEvForm((f) => ({ ...f, date: ymd }));
                                  setEventFormDateError(false);
                                  setEventFormCalendarOpen(false);
                                }}
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  fontSize: 13,
                                  cursor: "pointer",
                                  border: "none",
                                  padding: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: selected ? "#1a3a2a" : "transparent",
                                  color: selected ? "#fff" : cell.inCurrentMonth ? "#111" : "#ccc",
                                  fontWeight: today ? 700 : 400,
                                  ...(today && !selected ? { color: "#2d6a1f" } : {}),
                                }}
                                onMouseEnter={(e) => {
                                  if (!selected) e.currentTarget.style.background = "#f5f5f5";
                                }}
                                onMouseLeave={(e) => {
                                  if (!selected) e.currentTarget.style.background = "transparent";
                                }}
                              >
                                {cell.label}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
            </div>
            <div style={{ minWidth: 0 }}>
              <label className="text-xs mb-1 block" style={{ fontSize: 13, color: "#111" }}>Type</label>
              <select
                value={evForm.type}
                onChange={(e) => setEvForm((f) => ({ ...f, type: e.target.value }))}
                className={EVENT_FORM_FIELD_CLASS}
                style={{ fontFamily: "Inter, sans-serif", height: isMobile ? 44 : undefined }}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs mb-1 block" style={{ fontSize: 13, color: "#111" }}>Location</label>
              <input
                type="text"
                value={evForm.location}
                onChange={(e) => setEvForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. San Francisco, CA"
                className={EVENT_FORM_FIELD_CLASS}
                style={{ fontFamily: "Inter, sans-serif", height: isMobile ? 44 : undefined }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ fontSize: 13, color: "#111" }}>Notes</label>
            <textarea
              value={evForm.notes}
              onChange={(e) => setEvForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Goals, context, booth number..."
              rows={2}
              className={`${EVENT_FORM_FIELD_CLASS} resize-none`}
              style={{ fontFamily: "Inter, sans-serif", minHeight: isMobile ? 44 : undefined }}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: 24 }}>
          {events.map((ev) => {
            const isSelected = selectedIds.includes(ev.id);
            const dateValid = Boolean(ev.date && !isNaN(new Date(ev.date).getTime()));
            const schedule = getEventScheduleStatus(ev.date);
            const contactCount = getContactCount(ev.id);

            return (
              <div
                key={ev.id}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  border: "1px solid #ebebeb",
                  boxShadow: EVENT_CARD_SHADOW,
                  overflow: "visible",
                  display: "flex",
                  flexDirection: "row",
                  height: 120,
                  alignItems: "stretch",
                }}
              >
                <img
                  src={getEventThumbnailSrc(ev.type)}
                  alt=""
                  style={{
                    width: 140,
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "10px 0 0 10px",
                    flexShrink: 0,
                    display: "block",
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "20px 24px",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
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
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Link
                      href={`/dashboard/${ev.id}`}
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#111",
                        textDecoration: "none",
                        lineHeight: 1.25,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ev.name}
                    </Link>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#999",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {dateValid && (
                        <span>
                          {new Date(ev.date + "T00:00:00").toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      {dateValid && ev.location ? " · " : ""}
                      {ev.location ? ev.location : ""}
                      {!dateValid && !ev.location ? "—" : ""}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: "fit-content",
                          background: "#f0f7eb",
                          color: "#2d6a1f",
                          borderRadius: 99,
                          fontSize: 11,
                          padding: "2px 10px",
                          fontWeight: 500,
                        }}
                      >
                        {contactCount} contact{contactCount !== 1 ? "s" : ""}
                      </span>
                      {schedule === "upcoming" ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "#e8f4ec",
                            color: "#1a5c38",
                          }}
                        >
                          Upcoming
                        </span>
                      ) : schedule === "past" ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "#f0f0f0",
                            color: "#666",
                          }}
                        >
                          Past
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    alignSelf: "stretch",
                    padding: "20px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 8,
                    boxSizing: "border-box",
                  }}
                >
                  <Link
                    href={`/dashboard/${ev.id}`}
                    style={{
                      background: "#1a3a2a",
                      color: "#fff",
                      fontSize: 12,
                      padding: "6px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      textDecoration: "none",
                      fontWeight: 500,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    View Dashboard
                  </Link>
                  {renderEventOverflowMenu(ev)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && isMobile && (
      <div>
        {events.map((ev) => {
          const evContacts = contacts.filter((c) => c.event === ev.id);
          const hotCount = evContacts.filter((c) => c.leadScore >= 3).length;
          const isSelected = selectedIds.includes(ev.id);
          const schedule = getEventScheduleStatus(ev.date);
          return (
            <div
              key={ev.id}
              style={{
                background: "#fff",
                border: "1px solid #ebebeb",
                borderRadius: isMobile ? 14 : 16,
                padding: isMobile ? "16px" : "20px 24px",
                marginBottom: 12,
                boxShadow: EVENT_CARD_SHADOW,
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
                      <Link
                        href={`/dashboard/${ev.id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#111",
                          whiteSpace: "normal",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          textDecoration: "none",
                        }}
                      >
                        {ev.name}
                      </Link>
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
                      {schedule === "upcoming" ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "#e8f4ec",
                            color: "#1a5c38",
                            marginLeft: 8,
                          }}
                        >
                          Upcoming
                        </span>
                      ) : schedule === "past" ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "#f0f0f0",
                            color: "#666",
                            marginLeft: 8,
                          }}
                        >
                          Past
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                      {ev.date && !isNaN(new Date(ev.date).getTime()) && (
                        <span>
                          {new Date(ev.date + "T00:00:00").toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      {ev.date && !isNaN(new Date(ev.date).getTime()) && ev.location ? " · " : ""}
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 4,
                    flexWrap: "nowrap",
                  }}
                >
                  <Link
                    href={`/dashboard/${ev.id}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: "#1a3a2a",
                      color: "#fff",
                      fontSize: 12,
                      padding: "8px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      textDecoration: "none",
                      fontWeight: 500,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "none",
                      boxSizing: "border-box",
                      flexShrink: 0,
                    }}
                  >
                    View Dashboard
                  </Link>
                  {renderEventOverflowMenu(ev, true)}
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
