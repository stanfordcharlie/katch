"use client";

import { useEffect, useState } from "react";
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

  const followUpEventLabel = (eventId: string | null) => {
    if (!eventId) return "—";
    const name = events.find((e) => e.id === eventId)?.name;
    return name && name.trim() ? name : "—";
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
    if (s >= 9) return { label: "Fire", color: "#c47c2a", bg: "#fff3e8" };
    if (s >= 8) return { label: "Hot", color: "#b45309", bg: "#fef3c7" };
    if (s >= 5) return { label: "Warm", color: "#166534", bg: "#dcfce7" };
    return { label: "Cold", color: "#4b5563", bg: "#e5e7eb" };
  };

  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f7f7f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999",
          fontSize: "14px",
          fontWeight: 400,
          lineHeight: 1.5,
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: isMobile ? "24px 24px 100px" : "24px 24px 32px",
        overflowX: "hidden",
        maxWidth: "100vw",
        color: "#111111",
      }}
    >
      {/* Hero card */}
      {loading ? (
        <div
          className="skeleton"
          style={{
            borderRadius: 20,
            height: 200,
            marginBottom: 16,
            margin: "20px 20px 16px",
          }}
        />
      ) : (
      <section
        style={{
          background: "linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 30%, #1e4d6b 70%, #0f2a3d 100%)",
          borderRadius: 20,
          margin: "20px 20px 0",
          padding: isMobile ? "28px 22px" : "40px 48px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "center",
          minHeight: 200,
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 16 : 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 20,
            background: "radial-gradient(ellipse at 30% 50%, rgba(125,222,60,0.15) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ maxWidth: isMobile ? "100%" : "54%", width: isMobile ? "100%" : "auto", position: "relative", zIndex: 1 }}>
          <h1
            style={{
              fontSize: "clamp(28px, 3.5vw, 42px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              color: "#ffffff",
              marginBottom: 6,
            }}
          >
            {greeting}, {firstName}
          </h1>
          <p
            style={{
              fontSize: "15px",
              fontWeight: 400,
              lineHeight: 1.45,
              color: "rgba(255,255,255,0.55)",
              marginBottom: 0,
            }}
          >
            Here&apos;s your event pipeline at a glance.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minWidth: isMobile ? 0 : 220,
            width: isMobile ? "100%" : "auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          {[
            { label: "TOTAL SCANNED", value: totalContactsCount.toString() },
            { label: "HOT LEADS", value: hotLeadsCount.toString() },
            { label: "SEQUENCES SENT", value: "—" },
            { label: "EVENTS ATTENDED", value: eventsAttended.toString() },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {stat.label}
              </span>
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  color: "#ffffff",
                }}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* Quick actions */}
      {loading ? (
        <section
          style={{
            margin: "20px 20px 0",
            display: isMobile ? "flex" : "grid",
            gridTemplateColumns: isMobile ? undefined : "repeat(3, minmax(0, 1fr))",
            flexDirection: isMobile ? "column" : undefined,
            gap: isMobile ? 10 : 16,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{
                borderRadius: 14,
                height: 120,
                width: "100%",
              }}
            />
          ))}
        </section>
      ) : (
      <section
        style={{
          margin: "20px 20px 0",
          display: isMobile ? "flex" : "grid",
          gridTemplateColumns: isMobile ? undefined : "repeat(3, minmax(0, 1fr))",
          flexDirection: isMobile ? "column" : undefined,
          gap: isMobile ? 10 : 16,
        }}
      >
        {[
          {
            label: "Scan a badge",
            desc: "Open the scanner and capture a new contact.",
            href: "/scan",
            iconBg: "#f0f7eb",
            iconColor: "#2d6a1f",
            icon: (
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                <path d="M2 5a1 1 0 011-1h1.5l1-2h5l1 2H13a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                <circle cx="8" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
              </svg>
            ),
          },
          {
            label: "Generate sequences",
            desc: "Write thoughtful follow-up emails in one click.",
            href: "/sequences",
            iconBg: "#f0f4ff",
            iconColor: "#4a6cf7",
            icon: (
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                <path d="M2 6l6 4 6-4" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
            ),
          },
          {
            label: "Import attendees",
            desc: "Upload event lists and enrich them automatically.",
            href: "/leads",
            iconBg: "#fff3eb",
            iconColor: "#b07020",
            icon: (
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                <path d="M8 10V3M5 6l3-3 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M3 12h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            ),
          },
        ].map((qa) => (
          <button
            key={qa.href}
            onClick={() => router.push(qa.href)}
            style={{
              textAlign: "left",
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #ebebeb",
              padding: 24,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: isMobile ? "100%" : "auto",
              minWidth: isMobile ? 0 : undefined,
              minHeight: isMobile ? 44 : 150,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: qa.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: qa.iconColor,
              }}
            >
              {qa.icon}
            </div>
            <div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  color: "#111111",
                  marginTop: 16,
                  marginBottom: 4,
                }}
              >
                {qa.label}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 400,
                  lineHeight: 1.5,
                  color: "#999999",
                }}
              >
                {qa.desc}
              </div>
            </div>
          </button>
        ))}
      </section>
      )}

      {loading ? (
        <section
          style={{
            margin: "22px 20px 0",
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 3fr) minmax(0, 2fr)",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          <div
            className="skeleton"
            style={{
              borderRadius: 12,
              minHeight: 180,
              border: "1px solid #ebebeb",
            }}
          />
          <div
            className="skeleton"
            style={{
              borderRadius: 12,
              minHeight: 180,
              border: "1px solid #ebebeb",
            }}
          />
        </section>
      ) : (
      <section
        style={{
          margin: "22px 20px 0",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 3fr) minmax(0, 2fr)",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        {/* Recent Events */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #ebebeb",
            padding: "14px 16px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <h2
              style={{
                fontSize: "15px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "#111111",
              }}
            >
              Recent events
            </h2>
            <button
              type="button"
              onClick={() => router.push("/events")}
              style={{
                border: "none",
                background: "transparent",
                color: "#7dde3c",
                fontSize: "13px",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                cursor: "pointer",
                textDecoration: "none",
                minHeight: isMobile ? 44 : undefined,
              }}
            >
              View all →
            </button>
          </div>
          {recentEvents.length === 0 ? (
            <p
              style={{
                fontSize: "13px",
                fontWeight: 400,
                color: "#6b7280",
              }}
            >
              No events yet. Scan your first badge to see it here.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
              }}
            >
              {recentEvents.map((ev) => {
                const eventContacts = contactsByEventId.get(ev.id) || [];
                const highest = hottestScoreForEvent(ev.id);
                const badge = scoreBadge(highest);
                return (
                  <div
                    key={ev.id}
                    onClick={() => router.push("/events")}
                    style={{
                      padding: "14px 0",
                      borderBottom: "1px solid #f0f0f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f9f9f9";
                      e.currentTarget.style.borderRadius = "10px";
                      e.currentTarget.style.margin = "0 -12px";
                      e.currentTarget.style.padding = "14px 12px";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.borderRadius = "0";
                      e.currentTarget.style.margin = "0";
                      e.currentTarget.style.padding = "14px 0";
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 500,
                          letterSpacing: "-0.01em",
                          color: "#111111",
                        }}
                      >
                        {ev.name || "Untitled event"}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 400,
                          color: "#888888",
                        }}
                      >
                        {[formatDate(ev.date), ev.location].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          lineHeight: 1.5,
                          color: "#111",
                        }}
                      >
                        {eventContacts.length} contacts
                      </span>
                      {highest > 0 && (
                        <span
                          style={{
                            fontSize: "14px",
                            fontWeight: 400,
                            lineHeight: 1.5,
                            padding: "4px 10px",
                            borderRadius: 999,
                            backgroundColor: badge.bg,
                            color: badge.color,
                          }}
                        >
                          Max score {highest} · {badge.label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Needs follow-up */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #ebebeb",
            padding: "14px 16px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <h2
              style={{
                fontSize: "15px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "#111111",
              }}
            >
              Needs follow-up
            </h2>
            <button
              type="button"
              onClick={() => router.push("/contacts")}
              style={{
                border: "none",
                background: "transparent",
                color: "#7dde3c",
                fontSize: "13px",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                cursor: "pointer",
                textDecoration: "none",
                minHeight: isMobile ? 44 : undefined,
              }}
            >
              View all →
            </button>
          </div>
          {needsFollowUp.length === 0 ? (
            <p
              style={{
                fontSize: "13px",
                fontWeight: 400,
                color: "#6b7280",
              }}
            >
              You don&apos;t have any Hot or Fire leads yet.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
              }}
            >
              {needsFollowUp.map((c) => {
                const badge = scoreBadge(c.lead_score ?? 0);
                const initials = (c.name || "?").trim().charAt(0).toUpperCase();
                return (
                  <div
                    key={c.id}
                    onClick={() => router.push("/contacts")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: "1px solid #f0f0f0",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f9f9f9";
                      e.currentTarget.style.borderRadius = "10px";
                      e.currentTarget.style.margin = "0 -12px";
                      e.currentTarget.style.padding = "10px 12px";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.borderRadius = "0";
                      e.currentTarget.style.margin = "0";
                      e.currentTarget.style.padding = "10px 0";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          backgroundColor: badge.bg,
                          color: badge.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 500,
                          color: "#111111",
                        }}
                      >
                        {c.name || "Unknown contact"}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 400,
                          color: "#999",
                        }}
                      >
                        {followUpEventLabel(c.event)}
                      </div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        lineHeight: 1.5,
                        padding: "4px 10px",
                        borderRadius: 999,
                        backgroundColor: badge.bg,
                        color: badge.color,
                      }}
                    >
                      {c.lead_score ?? 0}/10 · {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
      )}
    </div>
  );
}

