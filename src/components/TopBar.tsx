"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import HelpDrawer from "@/components/HelpDrawer";

const PATH_TITLES: Record<string, string> = {
  "/home": "Home",
  "/scan": "Scan",
  "/contacts": "Contacts",
  "/events": "Events",
  "/dashboard": "Dashboard",
  "/sequences": "Sequences",
  "/settings": "Settings",
  "/account": "Account",
};

const PAGE_ENTRIES: {
  label: string;
  path: string;
  keywords: string[];
}[] = [
  { label: "Home", path: "/home", keywords: ["home", "dashboard overview"] },
  { label: "Scan Badge", path: "/scan", keywords: ["scan", "badge", "camera", "upload", "business card"] },
  { label: "Contacts", path: "/contacts", keywords: ["contacts", "leads", "people"] },
  { label: "Events", path: "/events", keywords: ["events", "conference", "tradeshow"] },
  { label: "Dashboard", path: "/dashboard", keywords: ["dashboard", "stats", "analytics", "charts"] },
  { label: "Sequences", path: "/sequences", keywords: ["sequences", "email", "follow up", "ai"] },
  { label: "Settings", path: "/settings", keywords: ["settings", "signals", "tone", "preferences"] },
  { label: "Account", path: "/account", keywords: ["account", "profile", "avatar", "name"] },
];

function getDisplayName(user: User, screenName: string | null): string {
  if (screenName?.trim()) return screenName.trim();
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const display = (meta?.display_name as string | undefined)?.trim();
  const full = (meta?.full_name as string | undefined)?.trim();
  const name = (meta?.name as string | undefined)?.trim();
  if (display) return display;
  if (full) return full;
  if (name) return name;
  const email = user.email ?? "";
  const beforeAt = email.split("@")[0]?.trim() || "";
  return beforeAt ? beforeAt.charAt(0).toUpperCase() + beforeAt.slice(1).toLowerCase() : "User";
}

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/settings")) return "Settings";
  if (PATH_TITLES[pathname]) return PATH_TITLES[pathname];
  const base = "/" + pathname.split("/").filter(Boolean)[0];
  return PATH_TITLES[base] ?? "Katch";
}

function leadScoreDotColor(score: number | null): string {
  if (score == null) return "#999";
  if (score >= 7) return "#22c55e";
  if (score >= 4) return "#f97316";
  return "#ef4444";
}

type ContactRow = {
  id: string;
  name: string | null;
  title: string | null;
  company: string | null;
  lead_score: number | null;
};

export function TopBar({
  sidebarCollapsed,
  isMobile,
  user,
}: {
  sidebarCollapsed: boolean;
  isMobile: boolean;
  user: User;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [screenName, setScreenName] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const accountWrapRef = useRef<HTMLDivElement>(null);

  const displayName = useMemo(() => getDisplayName(user, screenName), [user, screenName]);
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const u = data.user as User | null;
      if (!u) return;
      const meta = u.user_metadata as Record<string, unknown> | undefined;
      const url = (meta?.avatar_url as string | undefined) || null;
      if (url) setAvatarUrl(url);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("user_settings")
      .select("screen_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted || !data) return;
        const sn = (data as { screen_name?: string | null }).screen_name;
        if (typeof sn === "string" && sn.trim()) setScreenName(sn.trim());
      });
    return () => {
      mounted = false;
    };
  }, [user.id]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setContacts([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const esc = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
        const { data, error } = await supabase
          .from("contacts")
          .select("id, name, title, company, lead_score")
          .eq("user_id", user.id)
          .or(`name.ilike.%${esc}%,company.ilike.%${esc}%`)
          .limit(5);
        if (error) {
          console.error("TopBar contacts search:", error);
          setContacts([]);
          return;
        }
        setContacts((data as ContactRow[]) || []);
      })();
    }, 200);
    return () => window.clearTimeout(t);
  }, [query, user.id]);

  const pageResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return PAGE_ENTRIES.filter((p) => {
      if (p.label.toLowerCase().includes(q)) return true;
      return p.keywords.some((k) => {
        const kl = k.toLowerCase();
        return kl.includes(q) || q.includes(kl);
      });
    });
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountWrapRef.current && !accountWrapRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [accountOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const showDropdown = open && query.trim().length > 0 && (contacts.length > 0 || pageResults.length > 0);

  const onInputChange = useCallback((v: string) => {
    setQuery(v);
    setOpen(true);
  }, []);

  const onInputFocus = useCallback(() => {
    if (query.trim()) setOpen(true);
  }, [query]);

  if (isMobile) return null;

  const left = sidebarCollapsed ? "64px" : "230px";
  const barWidth = sidebarCollapsed ? "calc(100% - 64px)" : "calc(100% - 230px)";

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left,
        width: barWidth,
        height: 56,
        zIndex: 100,
        background: "#ffffff",
        borderBottom: "1px solid #ebebeb",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        transition: "left 0.2s ease, width 0.2s ease",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: "15px",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "#111",
          paddingLeft: 24,
          width: "auto",
          flexShrink: 0,
        }}
      >
        {pageTitle(pathname)}
      </div>

      <div
        ref={wrapRef}
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          minWidth: 0,
          position: "relative",
        }}
      >
        <div style={{ width: "100%", maxWidth: 480, position: "relative" }}>
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#999"
            strokeWidth={2}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => onInputChange(e.target.value)}
            onFocus={() => {
              setSearchFocused(true);
              onInputFocus();
            }}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search contacts, pages, features..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontSize: 13,
              color: "#111",
              padding: "8px 16px 8px 36px",
              background: searchFocused ? "#fff" : "#f5f5f5",
              border: "1px solid",
              borderColor: searchFocused ? "#ebebeb" : "transparent",
              borderRadius: 999,
              outline: "none",
              boxShadow: searchFocused ? "0 0 0 3px rgba(125,222,60,0.12)" : "none",
            }}
          />
          {showDropdown && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                right: 0,
                background: "#fff",
                border: "1px solid #ebebeb",
                borderRadius: 14,
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                padding: 8,
                maxHeight: 360,
                overflowY: "auto",
                zIndex: 200,
              }}
            >
              {contacts.length > 0 && (
                <div style={{ marginBottom: pageResults.length > 0 ? 8 : 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      color: "#999",
                      padding: "4px 8px",
                      textTransform: "uppercase",
                    }}
                  >
                    Contacts
                  </div>
                  {contacts.map((c) => {
                    const key = `c-${c.id}`;
                    const sub = [c.title, c.company].filter(Boolean).join(" · ");
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          router.push("/contacts");
                          setOpen(false);
                          setQuery("");
                        }}
                        onMouseEnter={() => setHoveredKey(key)}
                        onMouseLeave={() => setHoveredKey(null)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          border: "none",
                          background: hoveredKey === key ? "#f5f5f5" : "transparent",
                          borderRadius: 8,
                          padding: "8px 10px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: leadScoreDotColor(c.lead_score),
                            flexShrink: 0,
                            marginTop: 5,
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{c.name ?? "—"}</div>
                          <div style={{ fontSize: 12, color: "#999" }}>{sub || "—"}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {pageResults.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      color: "#999",
                      padding: "4px 8px",
                      textTransform: "uppercase",
                    }}
                  >
                    Pages
                  </div>
                  {pageResults.map((p) => {
                    const key = `p-${p.path}`;
                    return (
                      <button
                        key={p.path}
                        type="button"
                        onClick={() => {
                          router.push(p.path);
                          setOpen(false);
                          setQuery("");
                        }}
                        onMouseEnter={() => setHoveredKey(key)}
                        onMouseLeave={() => setHoveredKey(null)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          border: "none",
                          background: hoveredKey === key ? "#f5f5f5" : "transparent",
                          borderRadius: 8,
                          padding: "8px 10px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{p.label}</span>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth={2}>
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 20, paddingLeft: 8 }}>
        <button
          onClick={() => setHelpOpen(true)}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "#f5f5f5",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: 600,
            color: "#555",
            flexShrink: 0,
          }}
          title="Help & Support"
        >
          ?
        </button>
        <div ref={accountWrapRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setAccountOpen(!accountOpen)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                width={32}
                height={32}
                style={{ borderRadius: "50%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: "#1a3a2a",
                  color: "#7dde3c",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {initial}
              </span>
            )}
          </button>
          {accountOpen ? (
            <div
              style={{
                position: "absolute",
                top: "44px",
                right: 0,
                width: "240px",
                background: "#ffffff",
                border: "1px solid #ebebeb",
                borderRadius: "16px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                zIndex: 200,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "16px", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>
                  {screenName || user?.email?.split("@")[0]}
                </div>
                <div style={{ fontSize: "12px", color: "#999", marginTop: "2px" }}>{user?.email}</div>
              </div>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "#999" }}>Plan</span>
                  <span
                    style={{
                      background: "#f0f7eb",
                      color: "#2d6a1f",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "999px",
                      padding: "2px 10px",
                      letterSpacing: "0.02em",
                    }}
                  >
                    FREE
                  </span>
                </div>
              </div>
              {(
                [
                  { label: "Account settings", icon: "⚙", path: "/account" },
                  { label: "Settings", icon: "🔧", path: "/settings" },
                  {
                    label: "Help & Support",
                    icon: "?",
                    onClick: () => {
                      setHelpOpen(true);
                      setAccountOpen(false);
                    },
                  },
                ] as const
              ).map((item, i) => (
                <div
                  key={i}
                  onClick={() => {
                    if ("onClick" in item) {
                      item.onClick();
                      return;
                    }
                    router.push(item.path);
                    setAccountOpen(false);
                  }}
                  style={{
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#111",
                    cursor: "pointer",
                    borderBottom: "1px solid #f5f5f5",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f9f9f9";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ fontSize: "14px" }}>{item.icon}</span>
                  {item.label}
                </div>
              ))}
              <div
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push("/landing");
                  setAccountOpen(false);
                }}
                style={{
                  padding: "10px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#e55a5a",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fde8e8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span>→</span> Sign out
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <HelpDrawer isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </header>
  );
}
