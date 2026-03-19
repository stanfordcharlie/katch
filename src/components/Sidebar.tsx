"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
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

const DESKTOP_NAV = [
  { label: "Home", href: "/home", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 21V12h6v9"/></svg> },
  { label: "Scan", href: "/scan", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M21 9V5a2 2 0 00-2-2h-4M21 15v4a2 2 0 01-2 2h-4"/></svg> },
  { label: "Contacts", href: "/contacts", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
  { label: "Events", href: "/events", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> },
  { label: "Import", href: "/import", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
  { label: "Dashboard", href: "/dashboard", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { label: "Sequences", href: "/sequences", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
  { label: "Settings", href: "/settings", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M17.66 17.66l-1.41-1.41M6.34 17.66l1.41-1.41"/></svg> },
];

const MOBILE_NAV = [
  { label: "Home", href: "/home", icon: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 21V12h6v9"/></svg> },
  { label: "Scan", href: "/scan", icon: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M21 9V5a2 2 0 00-2-2h-4M21 15v4a2 2 0 01-2 2h-4"/></svg> },
  { label: "Contacts", href: "/contacts", icon: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
  { label: "Events", href: "/events", icon: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> },
  { label: "Settings", href: "/settings", icon: <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M17.66 17.66l-1.41-1.41M6.34 17.66l1.41-1.41"/></svg> },
];

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [displayName, setDisplayName] = useState(() => getDisplayName(user));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: "#ffffff", borderTop: "1px solid #ebebeb", height: 64, display: "flex", alignItems: "center", justifyContent: "space-evenly", paddingBottom: "env(safe-area-inset-bottom)", fontFamily: "Inter, -apple-system, sans-serif" }}>
        {MOBILE_NAV.map(({ label, href, icon }) => {
          const isActive = pathname === href || (href === "/settings" && pathname.startsWith("/settings"));
          return (
            <Link key={label} href={href} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: isActive ? "#2d6a1f" : "#999", textDecoration: "none", cursor: "pointer", padding: "4px 0" }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, color: isActive ? "#2d6a1f" : "#999" }}>{icon}</span>
              <span style={{ fontSize: 10, fontWeight: 500, marginTop: 3, lineHeight: 1, textAlign: "center" }}>{label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <aside style={{ width: 230, flexShrink: 0, position: "fixed", left: 0, top: 0, bottom: 0, backgroundColor: "#ffffff", borderRight: "1px solid #ebebeb", display: "flex", flexDirection: "column", zIndex: 30, fontFamily: "Inter, -apple-system, sans-serif" }}>
      <Link href="/home" style={{ padding: 18, display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <div style={{ width: 36, height: 36, background: "#ffffff", borderRadius: 10, border: "1px solid #e8e8e8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b6fd4" strokeWidth="2.5"><path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M21 9V5a2 2 0 00-2-2h-4M21 15v4a2 2 0 01-2 2h-4"/></svg>
        </div>
        <span style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>Katch</span>
      </Link>

      <nav style={{ flex: 1, padding: 8, marginTop: 4 }}>
        {DESKTOP_NAV.slice(0, 5).map(({ label, href, icon }) => {
          const isActive = pathname === href;
          return (
            <Link key={label} href={href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, cursor: "pointer", fontSize: 15, marginBottom: 2, textDecoration: "none", backgroundColor: isActive ? "#f0f7eb" : "transparent", color: isActive ? "#2d6a1f" : "#666666", fontWeight: isActive ? 500 : 400 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, color: isActive ? "#2d6a1f" : "#666666" }}>{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}

        <div style={{ height: 1, backgroundColor: "#f0f0f0", margin: "8px 4px" }} />

        {DESKTOP_NAV.slice(5, 7).map(({ label, href, icon }) => {
          const isActive = pathname === href;
          return (
            <Link key={label} href={href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, cursor: "pointer", fontSize: 15, marginBottom: 2, textDecoration: "none", backgroundColor: isActive ? "#f0f7eb" : "transparent", color: isActive ? "#2d6a1f" : "#666666", fontWeight: isActive ? 500 : 400 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, color: isActive ? "#2d6a1f" : "#666666" }}>{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}

        <div style={{ height: 1, backgroundColor: "#f0f0f0", margin: "8px 4px" }} />

        {(() => {
          const { label, href, icon } = DESKTOP_NAV[7];
          const isActive = pathname.startsWith("/settings");
          return (
            <Link key={label} href={href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, cursor: "pointer", fontSize: 15, marginBottom: 2, textDecoration: "none", backgroundColor: isActive ? "#f0f7eb" : "transparent", color: isActive ? "#2d6a1f" : "#666666", fontWeight: isActive ? 500 : 400 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, color: isActive ? "#2d6a1f" : "#666666" }}>{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })()}
      </nav>

      <div style={{ marginTop: "auto", borderTop: "1px solid #ebebeb", padding: "12px 10px" }}>
        <div onClick={() => router.push("/account")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderRadius: 8, padding: "4px 6px" }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} width={32} height={32} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <span style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#7ab648", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{initial}</span>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#333", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{displayName || "Account"}</span>
            <span style={{ fontSize: 12, color: "#888" }}>Account</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
// force deploy
