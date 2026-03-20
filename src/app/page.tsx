"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/home");
      } else {
        router.replace("/landing");
      }
    });
  }, [router]);

  return <div style={{ minHeight: "100vh", background: "#f7f7f5" }} />;
}
