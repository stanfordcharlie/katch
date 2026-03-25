"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Avatar, ScoreBadge } from "@/components/katch-ui";
import { NOTE_CHECKS } from "@/lib/katch-constants";

type EventStats = {
  name: string;
  total: number;
  avgScore: number;
  hotCount: number;
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [animatedStats, setAnimatedStats] = useState({
    total: 0,
    hot: 0,
    warm: 0,
    avg: 0,
  });
  const [barHeights, setBarHeights] = useState<number[]>([]);
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
        .select("id, name, date, location, type")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (contactsData) setContacts((contactsData as any[]) || []);
      if (eventsData) setEvents((eventsData as any[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [user?.id]);

  const filteredContacts = selectedEventId
    ? contacts.filter((c) => c.event === selectedEventId)
    : contacts;

  const eventsAttended = new Set(
    contacts.map((c) => c.event).filter(Boolean)
  ).size;

  const totalContacts = filteredContacts.length;
  const hotContacts = filteredContacts.filter(
    (c) => (Number(c.lead_score) || 0) >= 8
  );
  const warmContacts = filteredContacts.filter((c) => {
    const s = Number(c.lead_score) || 0;
    return s >= 5 && s <= 7;
  });
  const avgScore =
    totalContacts > 0
      ? filteredContacts.reduce((sum, c) => sum + (Number(c.lead_score) || 0), 0) / totalContacts
      : 0;

  const scoreBuckets = [
    { label: "1-2", min: 1, max: 2 },
    { label: "3-4", min: 3, max: 4 },
    { label: "5-6", min: 5, max: 6 },
    { label: "7-8", min: 7, max: 8 },
    { label: "9-10", min: 9, max: 10 },
  ].map((b) => ({
    ...b,
    count: filteredContacts.filter((c) => {
      const s = Number(c.lead_score) || 0;
      return s >= b.min && s <= b.max;
    }).length,
  }));

  const maxBucketCount = Math.max(
    ...scoreBuckets.map((b) => b.count),
    1
  );

  useEffect(() => {
    if (!contacts.length) return;
    const duration = 900;
    const start = performance.now();
    const startVals = { total: 0, hot: 0, warm: 0, avg: 0 };
    const targetVals = {
      total: filteredContacts.length,
      hot: hotContacts.length,
      warm: warmContacts.length,
      avg: avgScore,
    };
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = easeOutCubic(t);
      setAnimatedStats({
        total: Math.round(startVals.total + (targetVals.total - startVals.total) * e),
        hot: Math.round(startVals.hot + (targetVals.hot - startVals.hot) * e),
        warm: Math.round(startVals.warm + (targetVals.warm - startVals.warm) * e),
        avg: startVals.avg + (targetVals.avg - startVals.avg) * e,
      });
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [contacts.length, selectedEventId, filteredContacts.length, hotContacts.length, warmContacts.length, avgScore]);

  useEffect(() => {
    if (!scoreBuckets.length) return;
    const heights = scoreBuckets.map((b) => {
      if (b.count === 0) return 3;
      const pct = (b.count / maxBucketCount) * 100;
      return Math.max(pct, 8);
    });
    setBarHeights(heights);
  }, [contacts.length, selectedEventId, maxBucketCount]);

  if (!user) return <div className="min-h-screen" style={{ backgroundColor: "#f4f4f2" }} />;

  const signals = NOTE_CHECKS;
  const signalCounts = signals.map((s) => ({
    label: s.label,
    count: filteredContacts.filter((c) => c.checks?.includes(s.label)).length,
  }));
  const maxSignalCount = Math.max(
    ...signalCounts.map((s) => s.count),
    1
  );

  const eventStats: EventStats[] = events
    .map((ev) => {
      const evContacts = contacts.filter((c) => c.event === ev.id);
      if (!evContacts.length) return null;
      const total = evContacts.length;
      const avg =
        total > 0
          ? evContacts.reduce(
              (sum, c) => sum + (Number(c.lead_score) || 0),
              0
            ) / total
          : 0;
      const hot = evContacts.filter(
        (c) => (Number(c.lead_score) || 0) >= 8
      ).length;
      return {
        name: ev.name,
        total,
        avgScore: avg,
        hotCount: hot,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b as EventStats).total - (a as EventStats).total) as EventStats[];

  const recentContacts = [...filteredContacts]
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 5)
    .map((c) => ({
      ...c,
      createdAt: c.created_at ? new Date(c.created_at) : null,
    }));

  const daysAgo = (date: Date | null) => {
    if (!date) return "Unknown";
    const diffMs = Date.now() - date.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days <= 0) return "Today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f7f7f5",
        padding: isMobile ? "20px 16px 100px" : "32px 32px 40px",
        overflowX: "hidden",
        maxWidth: "1200px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <main style={{ maxWidth: 1120 }}>
        <div
          style={{
            background: "linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 30%, #1e4d6b 70%, #0f2a3d 100%)",
            borderRadius: 20,
            padding: isMobile ? "22px 20px" : "32px 40px",
            marginBottom: 24,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 20,
              pointerEvents: "none",
              background: "radial-gradient(ellipse at 30% 50%, rgba(125,222,60,0.15) 0%, transparent 60%)",
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h1
              style={{
                fontSize: isMobile ? "28px" : "32px",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                color: "#ffffff",
                margin: 0,
              }}
            >
              Dashboard
            </h1>
            <p
              style={{
                fontSize: "14px",
                fontWeight: 400,
                color: "rgba(255,255,255,0.55)",
                marginTop: 6,
                marginBottom: 0,
              }}
            >
              Your lead pipeline at a glance.
            </p>
            {events.length > 0 && (
              <div style={{ marginTop: isMobile ? 14 : 0, position: isMobile ? "static" : "absolute", top: 0, right: 0 }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.18)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                    }}
                    style={{
                      background: "rgba(255,255,255,0.12)",
                      color: "#ffffff",
                      border: "1px solid rgba(255,255,255,0.25)",
                      borderRadius: 10,
                      padding: "8px 16px",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                      outline: "none",
                      appearance: "none",
                      WebkitAppearance: "none",
                      backdropFilter: "blur(4px)",
                      WebkitBackdropFilter: "blur(4px)",
                    }}
                  >
                    <option value="" style={{ background: "#1a3a2a", color: "#fff" }}>All events</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id} style={{ background: "#1a3a2a", color: "#fff" }}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                    }}
                  >
                    <path
                      d="M2 4l4 4 4-4"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))",
                gap: isMobile ? 12 : 14,
                marginBottom: 24,
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{
                    border: "1px solid #ebebeb",
                    borderRadius: 16,
                    height: 120,
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{
                    border: "1px solid #ebebeb",
                    borderRadius: 16,
                    height: 200,
                  }}
                />
              ))}
            </div>
          </>
        ) : contacts.length === 0 ? (
          <div
            style={{
              marginTop: 32,
              borderRadius: 22,
              border: "1px dashed #d0d0c6",
              background: "#f7f7f3",
              padding: "52px 32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: "#e3ecdd",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4b6c34"
                strokeWidth="1.8"
              >
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <path d="M8 11h8M8 15h5" />
              </svg>
            </div>
            <p
              style={{
                fontSize: "17px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                lineHeight: 1.35,
                color: "#111111",
                margin: 0,
                marginBottom: 4,
              }}
            >
              No contacts yet
            </p>
            <p
              style={{
                fontSize: "13px",
                fontWeight: 400,
                color: "#999",
                margin: 0,
                marginBottom: 18,
              }}
            >
              Scan your first badge to start seeing your pipeline.
            </p>
            <Link
              href="/scan"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#1a3a2a",
                color: "#ffffff",
                border: "none",
                borderRadius: 10,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              Scan first contact
            </Link>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))",
                gap: isMobile ? 12 : 14,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #ebebeb",
                  borderRadius: 16,
                  padding: isMobile ? 16 : "20px 24px",
                  position: "relative",
                  overflow: "hidden",
                  opacity: 1,
                  transform: "translateY(0)",
                  animation: "dashStatIn 0.4s ease-out 0s forwards",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "#f0f7eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#7ab648"
                    strokeWidth="1.8"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                    <circle cx="10" cy="8" r="3.5" />
                    <path d="M19 11.5a2.5 2.5 0 1 0-2.5-2.5" />
                  </svg>
                </div>
                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.2,
                    color: "#111111",
                    marginBottom: 8,
                  }}
                >
                  {animatedStats.total}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "#999",
                    marginBottom: 8,
                  }}
                >
                  Total contacts
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 10px",
                    borderRadius: 999,
                    background: "#f0f7eb",
                    color: "#3a7a20",
                  }}
                >
                  {!selectedEventId
                    ? `${eventsAttended} event${eventsAttended !== 1 ? "s" : ""}`
                    : events.find((e) => e.id === selectedEventId)?.name || "Untagged"}
                </div>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #ebebeb",
                  borderRadius: 16,
                  padding: isMobile ? 16 : "20px 24px",
                  position: "relative",
                  overflow: "hidden",
                  opacity: 1,
                  transform: "translateY(0)",
                  animation: "dashStatIn 0.4s ease-out 0.06s forwards",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "#f0f7eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#7ab648"
                    strokeWidth="1.8"
                  >
                    <path d="M13 2L5 14h6l-1 8 8-12h-6z" />
                  </svg>
                </div>
                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.2,
                    color: "#111111",
                    marginBottom: 8,
                  }}
                >
                  {animatedStats.hot}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "#999",
                    marginBottom: 8,
                  }}
                >
                  Hot leads
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 10px",
                    borderRadius: 999,
                    background: "#f0f7eb",
                    color: "#2d6a1f",
                  }}
                >
                  Score 8–10
                </div>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #ebebeb",
                  borderRadius: 16,
                  padding: isMobile ? 16 : "20px 24px",
                  position: "relative",
                  overflow: "hidden",
                  opacity: 1,
                  transform: "translateY(0)",
                  animation: "dashStatIn 0.4s ease-out 0.12s forwards",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "#fff3eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f59e3f"
                    strokeWidth="1.8"
                  >
                    <path d="M12 3L7 13a5 5 0 1 0 10 0L12 3z" />
                  </svg>
                </div>
                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.2,
                    color: "#111111",
                    marginBottom: 8,
                  }}
                >
                  {animatedStats.warm}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "#999",
                    marginBottom: 8,
                  }}
                >
                  Warm leads
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 10px",
                    borderRadius: 999,
                    background: "#fff3eb",
                    color: "#b07020",
                  }}
                >
                  Score 5–7
                </div>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #ebebeb",
                  borderRadius: 16,
                  padding: isMobile ? 16 : "20px 24px",
                  position: "relative",
                  overflow: "hidden",
                  opacity: 1,
                  transform: "translateY(0)",
                  animation: "dashStatIn 0.4s ease-out 0.18s forwards",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "#f5f5f5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#888888"
                    strokeWidth="1.8"
                  >
                    <path d="M12 2l2.9 6.1L22 9.2l-5 4.9 1.2 7L12 17.8 5.8 21l1.2-7-5-4.9 7.1-1.1z" />
                  </svg>
                </div>
                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.2,
                    color: "#111111",
                    marginBottom: 8,
                  }}
                >
                  {animatedStats.avg % 1 === 0
                    ? animatedStats.avg.toString()
                    : animatedStats.avg.toFixed(1)}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "#999",
                    marginBottom: 8,
                  }}
                >
                  Avg score
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 10px",
                    borderRadius: 999,
                    background: "#f0f7eb",
                    color: "#3a7a20",
                  }}
                >
                  All contacts
                </div>
              </div>
            </div>

            <div
              style={{
                display: isMobile ? "flex" : "grid",
                flexDirection: isMobile ? "column" : undefined,
                gridTemplateColumns: isMobile ? undefined : "minmax(0,1.5fr) minmax(0,1fr)",
                gap: isMobile ? 14 : 16,
                alignItems: "flex-start",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <section
                  style={{
                    background: "#ffffff",
                    borderRadius: 16,
                    border: "1px solid #ebebeb",
                    padding: 24,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <p
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "#999",
                      margin: 0,
                      marginBottom: 20,
                    }}
                  >
                    LEAD SCORE DISTRIBUTION
                  </p>
                  <div
                    style={{
                      position: "relative",
                      height: isMobile ? 100 : 160,
                      marginBottom: 28,
                    }}
                  >
                    {[0.25, 0.5, 0.75].map((r) => (
                      <div
                        key={r}
                        style={{
                          position: "absolute",
                          insetInline: 0,
                          top: `${r * 100}%`,
                          borderTop: "1px dashed #f0f0f0",
                        }}
                      />
                    ))}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 8,
                        padding: "0 0 28px 0",
                      }}
                    >
                      {scoreBuckets.map((b) => {
                        const count = b.count;
                        const maxCount = Math.max(
                          ...scoreBuckets.map((x) => x.count),
                          1
                        );
                        const heightPct =
                          filteredContacts.length > 0
                            ? (count / maxCount) * 100
                            : 0;
                        const barHeight =
                          count === 0 ? "3px" : `${Math.max(heightPct, 8)}%`;
                        return (
                          <div
                            key={b.label}
                            style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              position: "relative",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: 400,
                                lineHeight: 1.5,
                                color: "#111111",
                                marginBottom: 6,
                              }}
                            >
                              {count}
                            </div>
                            <div
                              style={{
                                width: "100%",
                                borderRadius: "6px 6px 0 0",
                                height: barHeight,
                                background:
                                  count > 0
                                    ? "linear-gradient(to top, #5ab82e, #7dde3c)"
                                    : "#f0f0ee",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                bottom: -22,
                                fontSize: "13px",
                                fontWeight: 400,
                                color: "#999",
                              }}
                            >
                              {b.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section
                  style={{
                    background: "#ffffff",
                    borderRadius: 16,
                    border: "1px solid #ebebeb",
                    padding: 24,
                  }}
                >
                  <p
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "#999",
                      margin: 0,
                      marginBottom: 18,
                    }}
                  >
                    SIGNALS BREAKDOWN
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {signalCounts.map((s) => {
                      const pct =
                        totalContacts === 0
                          ? 0
                          : Math.round((s.count / totalContacts) * 100);
                      return (
                        <div
                          key={s.label}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: 400,
                              lineHeight: 1.5,
                              color: "#444444",
                              width: isMobile ? 110 : 140,
                              flexShrink: 0,
                            }}
                          >
                            {s.label}
                          </span>
                          <div
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 2,
                              background: "#f0f0f0",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background: "#7dde3c",
                                transition: "width 1.2s ease-out",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 400,
                              color: "#999",
                              minWidth: 32,
                              textAlign: "right",
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {eventStats.length > 0 && !selectedEventId && (
                  <section
                    style={{
                      background: "#ffffff",
                      borderRadius: 16,
                      border: "1px solid #ebebeb",
                      padding: 24,
                    }}
                  >
                    <p
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "#999",
                        margin: 0,
                        marginBottom: 16,
                      }}
                    >
                      LEADS BY EVENT
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {eventStats.map((ev) => (
                        <div
                          key={ev.name}
                          style={{
                            borderRadius: 14,
                            background: "#f9f9f7",
                            padding: isMobile ? "14px" : "16px 18px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 16,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: 400,
                                lineHeight: 1.5,
                                color: "#111111",
                                marginBottom: 4,
                              }}
                            >
                              {ev.name}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  background: "#ecf7e4",
                                  color: "#2d6a1f",
                                }}
                              >
                                {ev.total} leads
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  background: "#fff0e6",
                                  color: "#c26010",
                                }}
                              >
                                {ev.hotCount} hot
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div
                              style={{
                                fontSize: "24px",
                                fontWeight: 700,
                                letterSpacing: "-0.03em",
                                lineHeight: 1.2,
                                color: "#111111",
                              }}
                            >
                              {ev.avgScore.toFixed(1)}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                color: "#999",
                                marginTop: 4,
                              }}
                            >
                              avg score
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <section
                  style={{
                    background: "#ffffff",
                    borderRadius: 16,
                    border: "1px solid #ebebeb",
                    padding: 24,
                  }}
                >
                  <p
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "#999",
                      margin: 0,
                      marginBottom: 16,
                    }}
                  >
                    RECENT ACTIVITY
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {recentContacts.map((c, idx) => {
                      const score = Number(c.lead_score) || 0;
                      let badgeLabel = "Cold";
                      let badgeStyle = {
                        background: "#f4f4f4",
                        color: "#999999",
                      };
                      if (score >= 8) {
                        badgeLabel = "Fire";
                        badgeStyle = { background: "#fff0e6", color: "#c26010" };
                      } else if (score >= 6) {
                        badgeLabel = "Hot";
                        badgeStyle = { background: "#ecf7e4", color: "#2d6a1f" };
                      } else if (score >= 4) {
                        badgeLabel = "Warm";
                        badgeStyle = { background: "#fdf8e6", color: "#9a7010" };
                      }
                      return (
                        <div
                          key={c.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "12px 0",
                            borderBottom: "1px solid #f5f5f5",
                            opacity: 0,
                            transform: "translateX(-6px)",
                            animation: "dashRowIn 0.35s ease-out forwards",
                            animationDelay: `${idx * 60}ms`,
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              overflow: "hidden",
                              flexShrink: 0,
                              background: "#0d1f0d",
                              color: "#7dde3c",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {c.image ? (
                              <img
                                src={c.image as string}
                                alt={c.name || "Contact"}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              getInitials(c.name)
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "14px",
                              fontWeight: 600,
                                lineHeight: 1.5,
                                color: "#111111",
                                marginBottom: 2,
                              }}
                            >
                              {c.name || "Untitled contact"}
                            </div>
                            <div
                              style={{
                              fontSize: "12px",
                                fontWeight: 400,
                                color: "#999",
                              }}
                            >
                              {(c.company as string) || "No company"} ·{" "}
                              {daysAgo(c.createdAt)}
                            </div>
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: 600,
                              lineHeight: 1.5,
                              padding: "2px 10px",
                              borderRadius: 999,
                              ...badgeStyle,
                            }}
                          >
                            {badgeLabel}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </main>
      <style>
        {`@keyframes dashStatIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dashRowIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }`}
      </style>
    </div>
  );
}
