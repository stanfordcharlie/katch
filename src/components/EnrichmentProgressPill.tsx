"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export const ENRICHMENT_JOB_KEY = "katch_enrichment_job";

type EnrichmentJob = {
  id: number;
  filename?: string;
  totalContacts: number;
  startedAt: string;
  status: "processing" | "complete" | "error";
  progress?: number;
  results?: unknown[];
  openResultsModal?: boolean;
  eventId?: string | null;
  eventName?: string;
  errorMessage?: string;
};

function readJob(): EnrichmentJob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ENRICHMENT_JOB_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EnrichmentJob;
  } catch {
    return null;
  }
}

export function EnrichmentProgressPill() {
  const router = useRouter();
  const pathname = usePathname();
  const [job, setJob] = useState<EnrichmentJob | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [hideComplete, setHideComplete] = useState(false);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tick = () => setJob(readJob());
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const j = job;
    if (!j || j.status !== "processing") return;
    const tick = () => {
      const cur = readJob();
      if (!cur || cur.status !== "processing") return;
      const estimatedMs = Math.max(1, cur.totalContacts) * 1.5 * 1000;
      const elapsed = Date.now() - new Date(cur.startedAt).getTime();
      const fromTime = Math.min(90, Math.floor((elapsed / estimatedMs) * 90));
      const stored = typeof cur.progress === "number" ? cur.progress : 0;
      setDisplayProgress(Math.max(fromTime, Math.min(90, stored)));
    };
    tick();
    const iv = setInterval(tick, 200);
    return () => clearInterval(iv);
  }, [job?.status, job?.startedAt, job?.totalContacts, job?.id]);

  useEffect(() => {
    if (job?.status === "complete") {
      setHideComplete(false);
      completeTimerRef.current = setTimeout(() => setHideComplete(true), 10000);
      return () => {
        if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
      };
    }
    setHideComplete(false);
    return undefined;
  }, [job?.status, job?.id]);

  const viewResults = useCallback(() => {
    const j = readJob();
    if (!j?.results || !Array.isArray(j.results)) return;
    const next = { ...j, openResultsModal: true };
    localStorage.setItem(ENRICHMENT_JOB_KEY, JSON.stringify(next));
    if (pathname !== "/leads") {
      router.push("/leads");
    } else {
      window.dispatchEvent(new Event("katch-enrichment-open-modal"));
    }
  }, [pathname, router]);

  if (!job) return null;

  if (job.status === "processing") {
    const total = Math.max(1, job.totalContacts);
    const processed = Math.min(total, Math.round((displayProgress / 100) * total));
    return (
      <>
        <style>{`
          @keyframes katch-enrich-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9998,
            background: "#1a3a2a",
            color: "#fff",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            minWidth: 280,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              border: "2px solid rgba(255,255,255,0.3)",
              borderTop: "2px solid #7dde3c",
              borderRadius: 99,
              animation: "katch-enrich-spin 0.8s linear infinite",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Scoring leads...</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
              {processed} of {total} contacts processed
            </div>
          </div>
          <div
            style={{
              width: 60,
              height: 4,
              background: "rgba(255,255,255,0.2)",
              borderRadius: 99,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: `${displayProgress}%`,
                height: "100%",
                background: "#7dde3c",
                borderRadius: 99,
              }}
            />
          </div>
        </div>
      </>
    );
  }

  if (job.status === "complete" && !hideComplete) {
    const n = Array.isArray(job.results) ? job.results.length : 0;
    return (
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9998,
          background: "#f0f7eb",
          border: "1px solid #d4edbc",
          color: "#2d6a1f",
          borderRadius: 12,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          minWidth: 280,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
          <path
            d="M4 9l3.5 3.5L14 6"
            stroke="#2d6a1f"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
          Lead scoring complete — {n} contacts ready
        </span>
        <button
          type="button"
          onClick={viewResults}
          style={{
            background: "#1a3a2a",
            color: "#fff",
            borderRadius: 8,
            padding: "4px 12px",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            marginLeft: 8,
            border: "none",
            flexShrink: 0,
          }}
        >
          View results
        </button>
      </div>
    );
  }

  return null;
}
