"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

export const ENRICHMENT_JOB_KEY = "katch_enrichment_job";

const ENRICHMENT_RESULTS_KEY = "katch_enrichment_results";
const OPEN_RESULTS_FLAG = "katch_open_results";
const PILL_DISMISSED_KEY = "katch_pill_dismissed";

const pillDismissXButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#999",
  fontSize: 16,
  cursor: "pointer",
  padding: "0 0 0 8px",
  lineHeight: 1,
  fontWeight: 400,
};

type EnrichmentJob = {
  id: number;
  filename?: string;
  totalContacts: number;
  startedAt: string;
  status: "processing" | "complete" | "error" | "dismissed";
  progress?: number;
  processed?: number;
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

function patchJobMerge(patch: Record<string, unknown>) {
  try {
    const cur = readJob();
    if (!cur) return;
    localStorage.setItem(ENRICHMENT_JOB_KEY, JSON.stringify({ ...cur, ...patch }));
  } catch {
    /* ignore */
  }
}

function getResultsContactCount(): number {
  try {
    const raw = localStorage.getItem(ENRICHMENT_RESULTS_KEY);
    if (!raw) return 0;
    const d = JSON.parse(raw) as { contacts?: unknown[] };
    return Array.isArray(d.contacts) ? d.contacts.length : 0;
  } catch {
    return 0;
  }
}

export function EnrichmentProgressPill() {
  const router = useRouter();
  const [job, setJob] = useState<EnrichmentJob | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastJobIdRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      let j = readJob();
      if (j?.status === "processing" && j.startedAt) {
        const age = Date.now() - new Date(j.startedAt).getTime();
        if (age > 10 * 60 * 1000) {
          patchJobMerge({
            status: "error",
            errorMessage: "Lead scoring timed out — try again",
          });
          j = readJob();
        }
      }
      if (j?.id != null) {
        if (lastJobIdRef.current != null && j.id !== lastJobIdRef.current) {
          try {
            localStorage.removeItem(PILL_DISMISSED_KEY);
          } catch {
            /* ignore */
          }
        }
        lastJobIdRef.current = j.id;
      }
      let pillDismissed = false;
      try {
        pillDismissed = localStorage.getItem(PILL_DISMISSED_KEY) === "true";
      } catch {
        /* ignore */
      }
      let displayJob = j;
      if (j?.status === "processing" && pillDismissed) {
        displayJob = null;
      }
      setJob(displayJob);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (job?.status === "complete") {
      completeTimerRef.current = setTimeout(() => {
        patchJobMerge({ status: "dismissed" });
        setJob(readJob());
      }, 30000);
      return () => {
        if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
      };
    }
    return undefined;
  }, [job?.status, job?.id]);

  const barPercent =
    job?.status === "processing" ? Math.min(100, job.progress ?? 0) : 0;

  const viewResults = useCallback(() => {
    try {
      const raw = localStorage.getItem(ENRICHMENT_RESULTS_KEY);
      if (!raw) return;
      JSON.parse(raw);
      localStorage.setItem(OPEN_RESULTS_FLAG, "true");
      router.push("/leads");
    } catch {
      /* ignore */
    }
  }, [router]);

  const dismissError = useCallback(() => {
    patchJobMerge({ status: "dismissed" });
    setJob(readJob());
  }, []);

  const dismissProcessingPill = useCallback(() => {
    try {
      localStorage.setItem(PILL_DISMISSED_KEY, "true");
    } catch {
      /* ignore */
    }
    setJob(null);
  }, []);

  const dismissCompletePill = useCallback(() => {
    if (completeTimerRef.current) {
      clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }
    patchJobMerge({ status: "dismissed" });
    setJob(readJob());
  }, []);

  if (!job || job.status === "dismissed") return null;

  if (job.status === "processing") {
    const total = Math.max(1, job.totalContacts);
    const processed =
      typeof job.processed === "number"
        ? Math.min(total, job.processed)
        : Math.min(total, Math.round((barPercent / 100) * total));
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
                width: `${barPercent}%`,
                height: "100%",
                background: "#7dde3c",
                borderRadius: 99,
              }}
            />
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissProcessingPill}
            style={pillDismissXButtonStyle}
          >
            ×
          </button>
        </div>
      </>
    );
  }

  if (job.status === "error") {
    const msg =
      typeof job.errorMessage === "string" && job.errorMessage.trim()
        ? job.errorMessage
        : "Lead scoring timed out — try again";
    return (
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9998,
          background: "#fef2f2",
          color: "#e55a5a",
          borderRadius: 12,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          minWidth: 280,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{msg}</span>
        <button
          type="button"
          onClick={dismissError}
          style={{
            background: "transparent",
            border: "1px solid #fecaca",
            color: "#e55a5a",
            borderRadius: 8,
            padding: "4px 12px",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (job.status === "complete") {
    const n = getResultsContactCount() || (Array.isArray(job.results) ? job.results.length : 0);
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
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismissCompletePill}
          style={pillDismissXButtonStyle}
        >
          ×
        </button>
      </div>
    );
  }

  return null;
}
