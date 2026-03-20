"use client";

import { Sidebar } from "@/components/Sidebar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<unknown>(null);
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
        setUser(data.session.user);
      }
    });
  }, [router]);

  if (!user)
    return <div style={{ backgroundColor: "#f7f7f5", minHeight: "100dvh" }} />;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100dvh",
        backgroundColor: "#f7f7f5",
        overflowX: "hidden",
        maxWidth: "100vw",
        position: "relative",
      }}
    >
      {isMobile && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 99,
            height: 48,
            background: "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b6fd4" strokeWidth="2.5">
              <path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M21 9V5a2 2 0 00-2-2h-4M21 15v4a2 2 0 01-2 2h-4" />
            </svg>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#111", fontFamily: "Inter, sans-serif" }}>Katch</span>
          </div>
        </div>
      )}
      <Sidebar user={user as import("@supabase/supabase-js").User} />
      <main style={{ flex: 1, paddingLeft: isMobile ? 0 : 220, paddingTop: isMobile ? 48 : 0, paddingBottom: isMobile ? 80 : 0, backgroundColor: "#f7f7f5" }}>
        {children}
      </main>
    </div>
  );
}
