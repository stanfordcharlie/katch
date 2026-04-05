"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface Contact {
  id: string;
  name: string | null;
  company: string | null;
  /** Event row id (FK target), not a PostgREST embed relation name */
  event: string | null;
  lead_score: number | null;
}

interface EventRow {
  id: string;
  name: string | null;
  date: string | null;
  location: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalContactsCount, setTotalContactsCount] = useState(0);
  const [hotLeadsCount, setHotLeadsCount] = useState(0);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/landing");
      } else {
        setUser(data.session.user as User);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      setLoading(true);
      const [
        { data: contactsData },
        { data: eventsData },
        { count: totalCount },
        { count: hotCount },
      ] = await Promise.all([
        supabase
          .from("contacts")
          .select("*")
          .eq("user_id", user.id)
          .gte("lead_score", 7)
          .order("lead_score", { ascending: false })
          .limit(5),
        supabase
          .from("events")
          .select("id,name,date,location")
          .eq("user_id", user.id)
          .order("date", { ascending: false }),
        supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("lead_score", 7),
      ]);

      setContacts((contactsData as Contact[]) || []);
      setEvents((eventsData as EventRow[]) || []);
      setTotalContactsCount(totalCount ?? 0);
      setHotLeadsCount(hotCount ?? 0);
      setLoading(false);
    };

    load();
  }, [user?.id]);

  const firstName = (() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const display = (meta?.display_name as string | undefined)?.trim();
    const full = (meta?.full_name as string | undefined) || (meta?.name as string | undefined);
    const source = display || full;
    if (source) {
      const trimmed = source.trim();
      if (trimmed) return trimmed.split(" ")[0];
    }
    const email = user?.email ?? "";
    if (email) {
      const beforeAt = email.split("@")[0] || "";
      if (beforeAt) return beforeAt.charAt(0).toUpperCase() + beforeAt.slice(1);
    }
    return "there";
  })();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  const eventsAttended = events.length;

  const recentEvents = events.slice(0, 5);

  const contactsByEventId = new Map<string | null, Contact[]>();
  contacts.forEach((c) => {
    const key = c.event ?? null;
    if (!contactsByEventId.has(key)) contactsByEventId.set(key, []);
    contactsByEventId.get(key)!.push(c);
  });

  const hottestScoreForEvent = (eventId: string | null) => {
    const group = contactsByEventId.get(eventId ?? null) || [];
    return group.reduce((max, c) => Math.max(max, c.lead_score ?? 0), 0);
  };

  const followUpEventLabel = (eventId: string | null): string | null => {
    if (eventId == null || !String(eventId).trim()) return null;
    const trimmed = String(eventId).trim();
    const fromEvents = events.find((e) => e.id === trimmed)?.name?.trim();
    if (fromEvents) return fromEvents;
    const looksLikeUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed);
    if (looksLikeUuid) return null;
    return trimmed;
  };

  const needsFollowUp = contacts;

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const scoreBadge = (score: number | null) => {
    const s = score ?? 0;
    if (s >= 9) return { label: "Fire", color: "#ff9500", bg: "#fff3ee" };
    if (s >= 5) return { label: "Warm", color: "#2d6a1f", bg: "#f0faf0" };
    return { label: "Cold", color: "#999", bg: "#f5f5f5" };
  };

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f0f2f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999",
          fontSize: "14px",
          fontWeight: 400,
          lineHeight: 1.5,
          fontFamily: "Inter, sans-serif",
        }}
      >
        Loading…
      </div>
    );
  }

  const statItems = [
    { label: "TOTAL SCANNED", value: totalContactsCount.toString() },
    { label: "HOT LEADS", value: hotLeadsCount.toString() },
    { label: "SEQUENCES SENT", value: "—" },
    { label: "EVENTS ATTENDED", value: eventsAttended.toString() },
  ];

  const cardShell: CSSProperties = {
    background: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(0,0,0,0.06)",
    borderRadius: 14,
    padding: 20,
  };

  const pillStyle = (badge: { bg: string; color: string }) => ({
    fontSize: 11,
    fontWeight: 600 as const,
    borderRadius: 20,
    padding: "3px 8px",
    backgroundColor: badge.bg,
    color: badge.color,
    flexShrink: 0,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: isMobile ? "24px 24px 100px" : "24px",
        overflowX: "hidden",
        maxWidth: "100vw",
        color: "#111",
        backgroundColor: "#f0f2f0",
        fontFamily: "Inter, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {loading ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16 }}>
            <div className="skeleton" style={{ height: 72, flex: 1, maxWidth: 320, borderRadius: 10 }} />
            <div className="skeleton" style={{ height: 36, width: 120, borderRadius: 8 }} />
          </div>
          <div className="skeleton" style={{ height: 72, borderRadius: 14, marginBottom: 20 }} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 20,
              alignItems: "flex-start",
            }}
          >
            <div className="skeleton" style={{ minHeight: 220, borderRadius: 14 }} />
            <div className="skeleton" style={{ minHeight: 220, borderRadius: 14 }} />
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "stretch" : "center",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ fontSize: 28, fontWeight: 500, color: "#111", lineHeight: 1.2 }}>
                {greeting}, {firstName}
              </div>
              <div style={{ fontSize: 13, color: "#999", marginTop: 4 }}>{todayLabel}</div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/events")}
              style={{
                background: "#1a3a2a",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                alignSelf: isMobile ? "stretch" : "auto",
                width: isMobile ? "100%" : "auto",
              }}
            >
              + New Event
            </button>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(0,0,0,0.06)",
              borderRadius: 14,
              padding: "14px 24px",
              display: "flex",
              flexWrap: isMobile ? "wrap" : "nowrap",
              gap: 0,
              alignItems: "stretch",
              justifyContent: isMobile ? "space-around" : "flex-start",
              marginBottom: 20,
              overflowX: isMobile ? "auto" : "visible",
            }}
          >
            {statItems.map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  padding: "0 28px",
                  borderLeft: i > 0 ? "1px solid rgba(0,0,0,0.08)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  minWidth: isMobile ? 100 : undefined,
                  flex: isMobile ? "1 1 auto" : undefined,
                }}
              >
                <span style={{ fontSize: 20, fontWeight: 600, color: "#111", lineHeight: 1.1 }}>{stat.value}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#999",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 500,
                    textAlign: "center",
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 20,
              alignItems: "flex-start",
            }}
          >
            <div style={cardShell}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#999",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                  }}
                >
                  Recent events
                </span>
                <button
                  type="button"
                  onClick={() => router.push("/events")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#1a3a2a",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    textDecoration: "none",
                    fontFamily: "Inter, sans-serif",
                    minHeight: isMobile ? 44 : undefined,
                    padding: 0,
                  }}
                >
                  View all
                </button>
              </div>
              {recentEvents.length === 0 ? (
                <p style={{ fontSize: 13, fontWeight: 400, color: "#6b7280", margin: 0 }}>
                  No events yet. Scan your first badge to see it here.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {recentEvents.map((ev) => {
                    const eventContacts = contactsByEventId.get(ev.id) || [];
                    const count = eventContacts.length;
                    const highest = hottestScoreForEvent(ev.id);
                    const badge = scoreBadge(highest);
                    return (
                      <div
                        key={ev.id}
                        onClick={() => router.push("/events")}
                        style={{
                          padding: "12px 0",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{ev.name || "Untitled event"}</div>
                          <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                            {[formatDate(ev.date), ev.location].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#111", whiteSpace: "nowrap" }}>
                            {count} contact{count === 1 ? "" : "s"}
                          </span>
                          {count > 0 && highest > 0 ? (
                            <span style={pillStyle(badge)}>
                              {highest} · {badge.label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={cardShell}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#999",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                  }}
                >
                  Needs follow-up
                </span>
                <button
                  type="button"
                  onClick={() => router.push("/contacts")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#1a3a2a",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    textDecoration: "none",
                    fontFamily: "Inter, sans-serif",
                    minHeight: isMobile ? 44 : undefined,
                    padding: 0,
                  }}
                >
                  View all
                </button>
              </div>
              {needsFollowUp.length === 0 ? (
                <p style={{ fontSize: 13, fontWeight: 400, color: "#6b7280", margin: 0 }}>
                  You don&apos;t have any Hot or Fire leads yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {needsFollowUp.map((c) => {
                    const badge = scoreBadge(c.lead_score ?? 0);
                    const initials = (c.name || "?").trim().charAt(0).toUpperCase();
                    const eventLine = followUpEventLabel(c.event);
                    return (
                      <div
                        key={c.id}
                        onClick={() => router.push("/contacts")}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          justifyContent: "space-between",
                          padding: "12px 0",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              backgroundColor: "#ebebeb",
                              color: "#555",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{c.name || "Unknown contact"}</div>
                            {eventLine ? (
                              <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{eventLine}</div>
                            ) : null}
                          </div>
                        </div>
                        <span style={pillStyle(badge)}>
                          {c.lead_score ?? 0}/10 · {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

