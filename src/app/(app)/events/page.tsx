"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { EVENT_TYPES } from "@/lib/katch-constants";

export default function EventsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
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
  const [attendeeInput, setAttendeeInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allContacts, setAllContacts] = useState<any[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

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
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
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
    };
    fetchData();
  }, [user?.id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const resetEvForm = () => {
    setEvForm({ name: "", date: "", type: "Conference", location: "", notes: "", attendees: [] });
    setAttendeeInput("");
  };

  const handleSaveEvent = async () => {
    if (!evForm.name.trim() || !user?.id) return;

    if (editingEvent) {
      const { data, error } = await supabase
        .from("events")
        .update(evForm)
        .eq("user_id", user.id)
        .eq("id", editingEvent)
        .select()
        .single();

      if (error) {
        showToast("Failed to update event");
        return;
      }
      setEvents((prev) => prev.map((e) => (e.id === editingEvent ? { ...e, ...data } : e)));
      showToast("Event updated");
    } else {
      const { data, error } = await supabase
        .from("events")
        .insert({ ...evForm, user_id: user.id })
        .select()
        .single();

      if (error || !data) {
        showToast("Failed to create event");
        return;
      }
      setEvents((prev) => [data, ...prev]);
      showToast("Event created");
    }
    setShowEventForm(false);
    setEditingEvent(null);
    resetEvForm();
  };

  const addAttendeeTag = () => {
    const val = attendeeInput.trim();
    if (!val || evForm.attendees.includes(val)) return;
    setEvForm((f) => ({ ...f, attendees: [...f.attendees, val] }));
    setAttendeeInput("");
  };

  const removeAttendee = (name: string) =>
    setEvForm((f) => ({ ...f, attendees: f.attendees.filter((a) => a !== name) }));

  const exportEventCsv = (eventName: string) => {
    const evContacts = contacts.filter((c) => c.event === eventName);
    if (evContacts.length === 0) {
      showToast("No contacts for this event yet");
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
        fontFamily: "Inter, -apple-system, sans-serif",
      }}
    >
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2 rounded-lg shadow-xl">
          {toast}
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
              fontSize: 13,
              color: "#7dde3c",
              cursor: "pointer",
              background: "none",
              border: "none",
              fontWeight: 500,
              padding: "0 12px",
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
              background: "#7dde3c",
              color: "#0a1a0a",
              border: "none",
              borderRadius: "10px",
              height: isMobile ? 40 : undefined,
              minHeight: isMobile ? 44 : undefined,
              padding: isMobile ? "0 14px" : "10px 18px",
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
            <label className="text-xs text-slate-500 mb-1.5 block" style={{ fontSize: 13 }}>Who&apos;s attending</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                placeholder="Name or company..."
                className="flex-1 text-sm text-slate-900 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 bg-slate-50"
                style={{ fontFamily: "Georgia, serif", color: "black", height: isMobile ? 44 : undefined }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addAttendeeTag();
                }}
              />
              <button
                onClick={addAttendeeTag}
                className="px-3 py-2 border border-slate-200 text-xs text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                style={{ minHeight: isMobile ? 44 : undefined }}
              >
                Tag
              </button>
            </div>
            {contacts.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-slate-400 mb-1.5">Tag from your contacts</p>
                <div className="flex flex-wrap gap-1.5">
                  {contacts
                    .filter((c) => !evForm.attendees.includes(c.name))
                    .slice(0, 8)
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          if (!evForm.attendees.includes(c.name))
                            setEvForm((f) => ({ ...f, attendees: [...f.attendees, c.name] }));
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 border border-slate-200 rounded-full text-xs text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all"
                      >
                        <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">
                          {c.name[0]}
                        </div>
                        {c.name}
                      </button>
                    ))}
                </div>
              </div>
            )}
            {evForm.attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {evForm.attendees.map((a) => (
                  <span
                    key={a}
                    className="flex items-center gap-1 rounded-full border border-[#1a3a2a] bg-[#f0f0ec] px-2.5 py-1 text-xs text-[#1a2e1a]"
                  >
                    {a}
                    <button onClick={() => removeAttendee(a)} className="opacity-60 hover:opacity-100 ml-0.5">
                      <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
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

      {events.length === 0 && !showEventForm && (
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

      <div>
        {events.map((ev) => {
          const evContacts = contacts.filter((c) => c.event === ev.name);
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
                    onClick={async (e) => {
                      e.stopPropagation();
                      const { error } = await supabase.from("events").delete().eq("id", ev.id);
                      if (error) {
                        console.error("Delete event error:", error);
                        return;
                      }
                      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
                      setSelectedIds((prev) => prev.filter((id) => id !== ev.id));
                      showToast("Event deleted");
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
                  {evContacts.length} contact{evContacts.length !== 1 ? "s" : ""}
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
                {evContacts.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                    {evContacts.slice(0, 5).map((c: any) => (
                      <div
                        key={c.id}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: "#f0f7eb",
                          color: "#2d6a1f",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {(c.name || "?").toString().trim().charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {evContacts.length > 5 && (
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: "#f0f7eb",
                          color: "#2d6a1f",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        +{evContacts.length - 5}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {expandedEventId === ev.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
                  {(() => {
                    const eventContacts = allContacts.filter((c) => c.event === ev.name);
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
              showToast(`${ids.length} events deleted`);
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
