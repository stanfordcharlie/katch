"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

function getDisplayName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const display = (meta?.display_name as string)?.trim();
  const full = (meta?.full_name as string)?.trim();
  const name = (meta?.name as string)?.trim();
  if (display) return display;
  if (full) return full;
  if (name) return name;
  const email = user.email ?? "";
  const beforeAt = email.split("@")[0]?.trim() || "";
  return beforeAt ? beforeAt.charAt(0).toUpperCase() + beforeAt.slice(1).toLowerCase() : "User";
}

const LEADS_NAV_ICON_DESKTOP = (
  <svg width={18} height={18} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4h9" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    <path d="M2 8h7" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    <path d="M2 12h5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    <path
      d="M13 9l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinejoin="round"
    />
  </svg>
);

const DESKTOP_NAV = [
  { label: "Home", href: "/home", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 21V12h6v9"/></svg> },
  { label: "Scan", href: "/scan", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M21 9V5a2 2 0 00-2-2h-4M21 15v4a2 2 0 01-2 2h-4"/></svg> },
  { label: "Contacts", href: "/contacts", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
  { label: "Events", href: "/events", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> },
  { label: "Lead Lists", href: "/leads", icon: LEADS_NAV_ICON_DESKTOP },
  { label: "Dashboard", href: "/dashboard", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { label: "Sequences", href: "/sequences", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
  { label: "Settings", href: "/settings", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M17.66 17.66l-1.41-1.41M6.34 17.66l1.41-1.41"/></svg> },
  { label: "Team", href: "/team", icon: <Users size={18} strokeWidth={1.8} /> },
];

const MOBILE_NAV = [
  { label: "Home", href: "/home", icon: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 21V12h6v9"/></svg> },
  { label: "Scan", href: "/scan", icon: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M21 9V5a2 2 0 00-2-2h-4M21 15v4a2 2 0 01-2 2h-4"/></svg> },
  { label: "Contacts", href: "/contacts", icon: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
  { label: "Events", href: "/events", icon: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> },
  { label: "Settings", href: "/settings", icon: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M17.66 17.66l-1.41-1.41M6.34 17.66l1.41-1.41"/></svg> },
];

function getTourId(label: string): string | undefined {
  const map: Record<string, string> = {
    Home: "home",
    Scan: "scan",
    Contacts: "contacts",
    Events: "events",
    "Lead Lists": "leads",
    Dashboard: "dashboard",
    Sequences: "sequences",
    Settings: "settings",
    Team: "team",
  };
  return map[label];
}

export function Sidebar({ user, isMobile }: { user: User; isMobile: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved === "true";
  });
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(() => getDisplayName(user));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const u = data.user as User | null;
      if (!u) return;
      setDisplayName(getDisplayName(u));
      const meta = u.user_metadata as Record<string, unknown> | undefined;
      const url = (meta?.avatar_url as string | undefined) || null;
      if (url) setAvatarUrl(url);
    });
    return () => { mounted = false; };
  }, []);

  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  if (isMobile) {
    return (
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000, background: "#ffffff", borderTop: "1px solid #ebebeb", height: 64, display: "flex", alignItems: "center", justifyContent: "space-evenly", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {MOBILE_NAV.map(({ label, href, icon }) => {
          const isActive = pathname === href || (href === "/settings" && pathname.startsWith("/settings"));
          return (
            <Link key={label} href={href} data-tour={getTourId(label)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: isActive ? "#2d6a1f" : "#999", textDecoration: "none", cursor: "pointer", padding: "4px 0" }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, color: isActive ? "#2d6a1f" : "#999" }}>{icon}</span>
              <span style={{ fontSize: 10, fontWeight: 500, marginTop: 3, lineHeight: 1, textAlign: "center" }}>{label}</span>
            </Link>
          );
        })}
        <Link
          href="/account"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: pathname.startsWith("/account") ? "#2d6a1f" : "#999",
            textDecoration: "none",
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          {avatarUrl ? (
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22 }}>
              <img src={avatarUrl} alt="" width={22} height={22} style={{ borderRadius: "50%", objectFit: "cover" }} />
            </span>
          ) : (
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                backgroundColor: "#1a3a2a",
                color: "#7dde3c",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {initial}
            </span>
          )}
          <span style={{ fontSize: 10, fontWeight: 500, marginTop: 3, lineHeight: 1, textAlign: "center" }}>Account</span>
        </Link>
      </nav>
    );
  }

  return (
    <aside style={{ width: collapsed ? 64 : 200, flexShrink: 0, position: "fixed", left: 0, top: 0, bottom: 0, backgroundColor: "#ffffff", borderRight: "1px solid #ebebeb", display: "flex", flexDirection: "column", zIndex: 30, transition: "width 0.2s ease" }}>
      <button
        type="button"
        title={collapsed ? "Expand navigation" : "Collapse navigation"}
        onClick={() => {
          const newValue = !collapsed;
          setCollapsed(newValue);
          localStorage.setItem("sidebarCollapsed", String(newValue));
          window.dispatchEvent(new Event("sidebarToggle"));
        }}
        style={{
          position: "absolute",
          right: -12,
          top: 72,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "#fff",
          border: "1px solid #ebebeb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 40,
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          padding: 0,
        }}
      >
        {collapsed ? (
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth={2.5}><path d="M9 18l6-6-6-6"/></svg>
        ) : (
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth={2.5}><path d="M15 18l-6-6 6-6"/></svg>
        )}
      </button>
      <Link href="/home" style={{ padding: 18, display: "flex", alignItems: "center", gap: 10, textDecoration: "none", justifyContent: collapsed ? "center" : "flex-start" }}>
        <div style={{ width: 36, height: 36, background: "#ffffff", borderRadius: 10, border: "1px solid #e8e8e8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b6fd4" strokeWidth="2.5"><path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M21 9V5a2 2 0 00-2-2h-4M21 15v4a2 2 0 01-2 2h-4"/></svg>
        </div>
      </Link>

      <nav style={{ flex: 1, padding: 8, marginTop: 4 }}>
        {DESKTOP_NAV.slice(0, 4).map(({ label, href, icon }) => {
          const isActive = pathname === href;
          return (
            <Link key={label} href={href} data-tour={getTourId(label)} onMouseEnter={() => collapsed && setHoveredItem(label)} onMouseLeave={() => setHoveredItem(null)} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 12, padding: collapsed ? "10px 0" : "10px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 2, textDecoration: "none", backgroundColor: isActive ? "#f0f7eb" : "transparent", color: isActive ? "#2d6a1f" : "#666666" }}>
              <span
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  ...(collapsed
                    ? { width: "100%", paddingLeft: 0, paddingRight: 0 }
                    : { width: 18, height: 18 }),
                  color: isActive ? "#2d6a1f" : "#666666",
                }}
              >
                {icon}
              </span>
              <span style={{ transition: "opacity 0.15s ease", opacity: collapsed ? 0 : 1, overflow: "hidden", whiteSpace: "nowrap", width: collapsed ? 0 : "auto", fontSize: "13px", fontWeight: 500, letterSpacing: "0", lineHeight: 1 }}>{label}</span>
              {collapsed && hoveredItem === label && (
                <div style={{ position: "absolute", left: 72, top: "50%", transform: "translateY(-50%)", background: "#1a2332", color: "#fff", fontSize: "12px", fontWeight: 500, padding: "5px 10px", borderRadius: 6, whiteSpace: "nowrap", zIndex: 50, pointerEvents: "none" }}>
                  {label}
                </div>
              )}
            </Link>
          );
        })}

        <div style={{ height: 1, backgroundColor: "#f0f0f0", margin: "8px 4px" }} />

        {DESKTOP_NAV.slice(4, 7).map(({ label, href, icon }) => {
          const isActive = pathname === href;
          return (
            <Link key={label} href={href} data-tour={getTourId(label)} onMouseEnter={() => collapsed && setHoveredItem(label)} onMouseLeave={() => setHoveredItem(null)} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 12, padding: collapsed ? "10px 0" : "10px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 2, textDecoration: "none", backgroundColor: isActive ? "#f0f7eb" : "transparent", color: isActive ? "#2d6a1f" : "#666666" }}>
              <span
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  ...(collapsed
                    ? { width: "100%", paddingLeft: 0, paddingRight: 0 }
                    : { width: 18, height: 18 }),
                  color: isActive ? "#2d6a1f" : "#666666",
                }}
              >
                {icon}
              </span>
              <span style={{ transition: "opacity 0.15s ease", opacity: collapsed ? 0 : 1, overflow: "hidden", whiteSpace: "nowrap", width: collapsed ? 0 : "auto", fontSize: "13px", fontWeight: 500, letterSpacing: "0", lineHeight: 1 }}>{label}</span>
              {collapsed && hoveredItem === label && (
                <div style={{ position: "absolute", left: 72, top: "50%", transform: "translateY(-50%)", background: "#1a2332", color: "#fff", fontSize: "12px", fontWeight: 500, padding: "5px 10px", borderRadius: 6, whiteSpace: "nowrap", zIndex: 50, pointerEvents: "none" }}>
                  {label}
                </div>
              )}
            </Link>
          );
        })}

        <div style={{ height: 1, backgroundColor: "#f0f0f0", margin: "8px 4px" }} />

        {(() => {
          const { label, href, icon } = DESKTOP_NAV[7];
          const isActive = pathname.startsWith("/settings");
          return (
            <Link key={label} href={href} data-tour={getTourId(label)} onMouseEnter={() => collapsed && setHoveredItem(label)} onMouseLeave={() => setHoveredItem(null)} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 12, padding: collapsed ? "10px 0" : "10px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 2, textDecoration: "none", backgroundColor: isActive ? "#f0f7eb" : "transparent", color: isActive ? "#2d6a1f" : "#666666", minHeight: 42 }}>
              <span
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  ...(collapsed
                    ? { width: "100%", paddingLeft: 0, paddingRight: 0 }
                    : { width: 18, height: 18 }),
                  color: isActive ? "#2d6a1f" : "#666666",
                }}
              >
                {icon}
              </span>
              <span style={{ transition: "opacity 0.15s ease", opacity: collapsed ? 0 : 1, overflow: "visible", whiteSpace: "nowrap", width: collapsed ? 0 : "auto", fontSize: "13px", fontWeight: 500, letterSpacing: "0", lineHeight: 1 }}>{label}</span>
              {collapsed && hoveredItem === label && (
                <div style={{ position: "absolute", left: 72, top: "50%", transform: "translateY(-50%)", background: "#1a2332", color: "#fff", fontSize: "12px", fontWeight: 500, padding: "5px 10px", borderRadius: 6, whiteSpace: "nowrap", zIndex: 50, pointerEvents: "none" }}>
                  {label}
                </div>
              )}
            </Link>
          );
        })()}
        {(() => {
          const { label, href, icon } = DESKTOP_NAV[8];
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={label} href={href} data-tour={getTourId(label)} onMouseEnter={() => collapsed && setHoveredItem(label)} onMouseLeave={() => setHoveredItem(null)} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 12, padding: collapsed ? "10px 0" : "10px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 2, textDecoration: "none", backgroundColor: isActive ? "#f0f7eb" : "transparent", color: isActive ? "#2d6a1f" : "#666666", minHeight: 42 }}>
              <span
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  ...(collapsed
                    ? { width: "100%", paddingLeft: 0, paddingRight: 0 }
                    : { width: 18, height: 18 }),
                  color: isActive ? "#2d6a1f" : "#666666",
                }}
              >
                {icon}
              </span>
              <span style={{ transition: "opacity 0.15s ease", opacity: collapsed ? 0 : 1, overflow: "visible", whiteSpace: "nowrap", width: collapsed ? 0 : "auto", fontSize: "13px", fontWeight: 500, letterSpacing: "0", lineHeight: 1 }}>{label}</span>
              {collapsed && hoveredItem === label && (
                <div style={{ position: "absolute", left: 72, top: "50%", transform: "translateY(-50%)", background: "#1a2332", color: "#fff", fontSize: "12px", fontWeight: 500, padding: "5px 10px", borderRadius: 6, whiteSpace: "nowrap", zIndex: 50, pointerEvents: "none" }}>
                  {label}
                </div>
              )}
            </Link>
          );
        })()}
      </nav>

    </aside>
  );
}
