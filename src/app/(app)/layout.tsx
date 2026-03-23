"use client";

import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import OnboardingTour from "@/components/OnboardingTour";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("katch_sidebar_collapsed");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    localStorage.setItem("katch_sidebar_collapsed", sidebarCollapsed ? "true" : "false");
  }, [sidebarCollapsed]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/landing");
      } else {
        const nextUser = data.session.user as User;
        setUser(nextUser);

        const { data: settings } = await supabase
          .from("user_settings")
          .select("onboarding_completed")
          .eq("user_id", nextUser.id)
          .single();

        if (!settings?.onboarding_completed) {
          timer = setTimeout(() => setShowTour(true), 800);
        }
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

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
          </div>
        </div>
      )}
      <Sidebar
        user={user}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        isMobile={isMobile}
      />
      {!isMobile && <TopBar sidebarCollapsed={sidebarCollapsed} isMobile={isMobile} user={user} />}
      <main
        style={{
          boxSizing: "border-box",
          overflowY: "auto",
          ...(isMobile
            ? {
                marginLeft: 0,
                width: "100%",
                transition: "margin-left 0.2s ease, width 0.2s ease",
              }
            : {
                marginLeft: sidebarCollapsed ? "64px" : "230px",
                transition: "margin-left 0.2s ease, width 0.2s ease",
                width: sidebarCollapsed ? "calc(100% - 64px)" : "calc(100% - 230px)",
              }),
          paddingTop: isMobile ? 48 : 56,
          paddingBottom: isMobile ? 80 : 0,
          backgroundColor: "#f7f7f5",
        }}
      >
        {children}
      </main>
      {showTour && <OnboardingTour onComplete={() => setShowTour(false)} />}
    </div>
  );
}
