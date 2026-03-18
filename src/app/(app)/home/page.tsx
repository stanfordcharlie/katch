"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface Contact {
  id: string;
  name: string | null;
  company: string | null;
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
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

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
      const [{ data: contactsData }, { data: eventsData }] = await Promise.all([
        supabase
          .from("contacts")
          .select("id,name,company,event,lead_score")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("events")
          .select("id,name,date,location")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(5),
      ]);

      setContacts((contactsData as Contact[]) || []);
      setEvents((eventsData as EventRow[]) || []);
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

  const totalContacts = contacts.length;
  const hotLeads = contacts.filter((c) => (c.lead_score ?? 0) >= 8).length;
  const eventsAttended = events.length;

  const recentEvents = events;

  const contactsByEventName = new Map<string | null, Contact[]>();
  contacts.forEach((c) => {
    const key = c.event ?? null;
    if (!contactsByEventName.has(key)) contactsByEventName.set(key, []);
    contactsByEventName.get(key)!.push(c);
  });

  const hottestScoreForEvent = (eventName: string | null) => {
    const group = contactsByEventName.get(eventName ?? null) || [];
    return group.reduce((max, c) => Math.max(max, c.lead_score ?? 0), 0);
  };

  const needsFollowUp = contacts.filter((c) => (c.lead_score ?? 0) >= 8).slice(0, 6);

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
          fontSize: 14,
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
        padding: "24px 32px 32px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#111111",
      }}
    >
      {/* Hero card */}
      <section
        style={{
          background: "linear-gradient(135deg, #e8f5d8 0%, #c8e8a0 40%, #a8d870 70%, #d4edb8 100%)",
          borderRadius: 16,
          margin: "20px 20px 0",
          padding: "36px 40px",
          border: "1px solid rgba(0,0,0,0.04)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          minHeight: 180,
        }}
      >
        <div style={{ maxWidth: "40%" }}>
          <p
            style={{
              fontSize: 13,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#2d6a1f",
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Overview
          </p>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: "#1a3a0a",
              letterSpacing: "-0.5px",
              marginBottom: 4,
            }}
          >
            {greeting}, {firstName}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "rgba(26,58,10,0.6)",
              marginBottom: 0,
            }}
          >
            Here&apos;s your event pipeline at a glance.
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
            maxWidth: "52%",
          }}
        >
          {[
            { label: "Total scanned", value: loading ? "…" : totalContacts.toString() },
            { label: "Hot / Fire leads", value: loading ? "…" : hotLeads.toString() },
            { label: "Sequences sent", value: "—" },
            { label: "Events attended", value: loading ? "…" : eventsAttended.toString() },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                backgroundColor: "rgba(255,255,255,0.65)",
                borderRadius: 12,
                padding: "14px 20px",
                minWidth: 120,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "rgba(26,58,10,0.55)",
                  marginBottom: 4,
                }}
              >
                {stat.label}
              </span>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#1a3a0a",
                }}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section
        style={{
          margin: "20px 20px 0",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        {[
          {
            label: "Scan a badge",
            desc: "Open the scanner and capture a new contact.",
            href: "/scan",
          },
          {
            label: "Generate sequences",
            desc: "Write thoughtful follow-up emails in one click.",
            href: "/sequences",
          },
          {
            label: "Import attendees",
            desc: "Upload event lists and enrich them automatically.",
            href: "/import",
          },
        ].map((qa) => (
          <button
            key={qa.href}
            onClick={() => router.push(qa.href)}
            style={{
              textAlign: "left",
              background: "#ffffff",
              borderRadius: 12,
              border: "1px solid #ebebeb",
              padding: 24,
              minHeight: 120,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: "#f0f7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
                color: "#2d6a1f",
              }}
            >
              <span style={{ fontSize: 16 }}>↗</span>
            </div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111111",
                  marginBottom: 4,
                }}
              >
                {qa.label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#888888",
                }}
              >
                {qa.desc}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                marginTop: 12,
                fontSize: 16,
                color: "#7ab648",
              }}
            >
              →
            </div>
          </button>
        ))}
      </section>

      <section
        style={{
          margin: "22px 20px 0",
          display: "grid",
          gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
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
                fontSize: 15,
                fontWeight: 600,
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
                color: "#4b5563",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              View all →
            </button>
          </div>
          {recentEvents.length === 0 ? (
            <p
              style={{
                fontSize: 13,
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
                gap: 8,
              }}
            >
              {recentEvents.map((ev) => {
                const eventContacts = contactsByEventName.get(ev.name ?? null) || [];
                const highest = hottestScoreForEvent(ev.name ?? null);
                const badge = scoreBadge(highest);
                return (
                  <div
                    key={ev.id}
                    style={{
                      padding: "16px 20px",
                      borderRadius: 10,
                      border: "1px solid #ebebeb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#111111",
                        }}
                      >
                        {ev.name || "Untitled event"}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
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
                          fontSize: 13,
                          color: "#4b5563",
                          fontWeight: 500,
                        }}
                      >
                        {eventContacts.length} contacts
                      </span>
                      {highest > 0 && (
                        <span
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                            borderRadius: 999,
                            backgroundColor: badge.bg,
                            color: badge.color,
                            fontWeight: 500,
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
                fontSize: 15,
                fontWeight: 600,
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
                color: "#4b5563",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              View all →
            </button>
          </div>
          {needsFollowUp.length === 0 ? (
            <p
              style={{
                fontSize: 13,
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
                gap: 8,
              }}
            >
              {needsFollowUp.map((c) => {
                const badge = scoreBadge(c.lead_score ?? 0);
                return (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: "1px solid #ebebeb",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#111111",
                        }}
                      >
                        {c.name || "Unknown contact"}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                        }}
                      >
                        {c.company || c.event || "No company info"}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
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
    </div>
  );
}

