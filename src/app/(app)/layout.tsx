"use client";

import { Sidebar } from "@/components/Sidebar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<unknown>(null);

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
    return <div style={{ backgroundColor: "#f7f7f5", minHeight: "100vh" }} />;

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f7f7f5" }}>
      <Sidebar user={user as import("@supabase/supabase-js").User} />
      <main style={{ flex: 1, paddingLeft: 220, backgroundColor: "#f7f7f5" }}>
        {children}
      </main>
    </div>
  );
}
