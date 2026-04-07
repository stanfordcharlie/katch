"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ENRICHMENT_JOB_KEY } from "@/components/EnrichmentProgressPill";

const LS_KEY = "katch_lead_lists";

function readEnrichmentJob(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ENRICHMENT_JOB_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeEnrichmentJobFull(job: Record<string, unknown>) {
  localStorage.setItem(ENRICHMENT_JOB_KEY, JSON.stringify(job));
}

function patchEnrichmentJob(patch: Record<string, unknown>) {
  const cur = readEnrichmentJob() || {};
  localStorage.setItem(ENRICHMENT_JOB_KEY, JSON.stringify({ ...cur, ...patch }));
}

const ENRICHMENT_RESULTS_KEY = "katch_enrichment_results";
const OPEN_RESULTS_FLAG = "katch_open_results";

const parseCSV = (text: string): string[][] => {
  const results: string[][] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQuotes) {
        inQuotes = true;
      } else if (ch === '"' && inQuotes) {
        inQuotes = false;
      } else if (ch === "," && !inQuotes) {
        row.push(cell.trim());
        cell = "";
      } else {
        cell += ch;
      }
    }
    row.push(cell.trim());
    results.push(row);
  }
  return results;
};

type EventRow = { id: string; name: string | null };

type EnrichedRow = {
  __id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  phone: string;
  linkedin: string;
  ai_enrichment: Record<string, unknown>;
  icp_fit_score: number;
  icp_fit_reason: string;
  suggested_lead_score: number;
  summary: string;
  talking_points: unknown[];
  red_flags: unknown[];
  status?: "prospect" | "captured";
};

type StoredLeadList = {
  id: number;
  filename: string;
  uploadDate: string;
  contactCount: number;
  savedCount: number;
  eventName: string;
  eventId: string | null;
  topScore: number;
  contacts: EnrichedRow[];
};

function readStoredLists(): StoredLeadList[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredLeadList[]) : [];
  } catch {
    return [];
  }
}

function mapRawContactsToEnrichedRows(enriched: unknown[], jobId: number): EnrichedRow[] {
  return enriched.map((c: unknown, i: number) => {
    const row = c as EnrichedRow;
    return {
      ...row,
      __id: row.__id || `row-${jobId}-${i}`,
      icp_fit_score: Number(row.icp_fit_score) || 0,
      suggested_lead_score: Number(row.suggested_lead_score) || 5,
      icp_fit_reason: typeof row.icp_fit_reason === "string" ? row.icp_fit_reason : "",
      summary: typeof row.summary === "string" ? row.summary : "",
      talking_points: Array.isArray(row.talking_points) ? row.talking_points : [],
      red_flags: Array.isArray(row.red_flags) ? row.red_flags : [],
      ai_enrichment: (row.ai_enrichment as Record<string, unknown>) || {},
      status: row.status === "captured" || row.status === "prospect" ? row.status : undefined,
    };
  });
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTableDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function scorePillStyle(score: number) {
  if (score >= 7) return { color: "#2d6a1f", background: "#f0f7eb" };
  if (score >= 4) return { color: "#b07020", background: "#fef9ec" };
  return { color: "#e55a5a", background: "#fef2f2" };
}

function distributionCounts(contacts: EnrichedRow[]) {
  let high = 0;
  let med = 0;
  let low = 0;
  for (const c of contacts) {
    const s = c.icp_fit_score ?? 0;
    if (s >= 7) high += 1;
    else if (s >= 4) med += 1;
    else low += 1;
  }
  return { high, med, low };
}

export default function LeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const eventDropdownRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [pastLists, setPastLists] = useState<StoredLeadList[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [listTiming, setListTiming] = useState<"pre" | "post" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDropZoneHover, setIsDropZoneHover] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [createEventNotice, setCreateEventNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [barProgress, setBarProgress] = useState(0);
  const [scoringCurrent, setScoringCurrent] = useState(0);
  const [scoringTotal, setScoringTotal] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [resultsModal, setResultsModal] = useState<{
    filename: string;
    eventId: string | null;
    eventName: string;
    contacts: EnrichedRow[];
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const showToast = useCallback((message: string, variant: "success" | "error" = "success") => {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/landing");
      else setUser(data.session.user as User);
    });
  }, [router]);

  useEffect(() => {
    setPastLists(readStoredLists());
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const job = readEnrichmentJob();
    if (!job) return;
    if (job.status !== "processing") return;
    const startedAt = typeof job.startedAt === "string" ? job.startedAt : "";
    const startedMs = new Date(startedAt).getTime();
    if (Number.isNaN(startedMs) || Date.now() - startedMs > 10 * 60 * 1000) return;
    const totalContacts = typeof job.totalContacts === "number" ? job.totalContacts : 0;
    const processed = typeof job.processed === "number" ? job.processed : 0;
    const pct =
      typeof job.progress === "number"
        ? job.progress
        : totalContacts > 0
          ? Math.round((processed / totalContacts) * 100)
          : 0;
    setEnrichLoading(true);
    setBarProgress(pct);
    setScoringCurrent(processed);
    setScoringTotal(totalContacts || 1);
    const storedLine =
      typeof job.progressText === "string" && job.progressText.trim()
        ? job.progressText
        : `Scoring contact ${processed} of ${totalContacts || 1} against your ICP...`;
    setProgressText(storedLine);
  }, []);

  useEffect(() => {
    if (!enrichLoading) return;
    let intervalId: number | undefined;
    const clear = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };
    const tick = () => {
      const job = readEnrichmentJob();
      if (!job || !mountedRef.current) return;
      const st = job.status;
      if (st === "complete") {
        clear();
        const raw = localStorage.getItem(ENRICHMENT_RESULTS_KEY);
        if (!raw) {
          setEnrichLoading(false);
          setProgressText("");
          return;
        }
        try {
          const data = JSON.parse(raw) as {
            contacts?: unknown[];
            filename?: string;
          };
          if (!data.contacts || !Array.isArray(data.contacts)) {
            setEnrichLoading(false);
            setProgressText("");
            return;
          }
          const jid = typeof job.id === "number" ? job.id : Date.now();
          const withIds = mapRawContactsToEnrichedRows(data.contacts, jid);
          const fn =
            (typeof data.filename === "string" && data.filename) ||
            (typeof job.filename === "string" ? job.filename : "leads.csv");
          const evId = job.eventId === undefined ? null : (job.eventId as string | null);
          const evName =
            typeof job.eventName === "string" && job.eventName ? job.eventName : "No specific event";
          setEnrichLoading(false);
          setProgressText("");
          setBarProgress(100);
          setScoringCurrent(withIds.length);
          setScoringTotal(withIds.length);
          setResultsModal({
            filename: fn,
            eventId: evId,
            eventName: evName,
            contacts: withIds,
          });
          setSelectedIds(withIds.filter((c) => (c.icp_fit_score ?? 0) >= 5).map((c) => c.__id));
        } catch {
          setEnrichLoading(false);
          setProgressText("");
        }
        return;
      }
      if (st === "error") {
        clear();
        const msg =
          typeof job.errorMessage === "string" && job.errorMessage.trim()
            ? job.errorMessage
            : "Enrichment failed — try again.";
        setEnrichLoading(false);
        setProgressText("");
        showToast(msg, "error");
        return;
      }
      if (st === "dismissed") {
        clear();
        setEnrichLoading(false);
        setProgressText("");
        return;
      }
      if (st === "processing") {
        const totalC = typeof job.totalContacts === "number" ? job.totalContacts : 0;
        const proc = typeof job.processed === "number" ? job.processed : 0;
        const realProgress =
          typeof job.progress === "number"
            ? job.progress
            : totalC > 0
              ? Math.round((proc / totalC) * 100)
              : 0;
        const line =
          typeof job.progressText === "string" && job.progressText.trim()
            ? job.progressText
            : `Scoring contact ${proc} of ${totalC || 1} against your ICP...`;
        setBarProgress(realProgress);
        setScoringCurrent(proc);
        setScoringTotal(totalC || 1);
        setProgressText(line);
      }
    };
    tick();
    intervalId = window.setInterval(tick, 500) as number;
    return () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [enrichLoading, showToast]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id,name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setEvents((data as EventRow[]) || []);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = eventDropdownRef.current;
      if (el && !el.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [isDropdownOpen]);

  const selectedEventLabel =
    selectedEventId === ""
      ? "No specific event"
      : events.find((ev) => ev.id === selectedEventId)?.name || "Untitled event";

  const handleCreateEventSubmit = async () => {
    const name = newEventName.trim();
    if (!name || !user?.id || isCreatingEvent) return;
    setIsCreatingEvent(true);
    setCreateEventNotice(null);
    const { data, error } = await supabase
      .from("events")
      .insert({
        user_id: user.id,
        name,
        date: newEventDate || new Date().toISOString(),
        type: "conference",
      })
      .select("id,name")
      .single();
    setIsCreatingEvent(false);
    if (error || !data) {
      setCreateEventNotice({ kind: "err", text: error?.message || "Could not create event" });
      return;
    }
    const row = data as EventRow;
    setEvents((prev) => [row, ...prev]);
    setSelectedEventId(row.id);
    setShowCreateForm(false);
    setNewEventName("");
    setNewEventDate("");
    setCreateEventNotice({ kind: "ok", text: "Event created" });
    window.setTimeout(() => setCreateEventNotice(null), 2000);
  };

  const openModalFromResultsFlag = useCallback(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(OPEN_RESULTS_FLAG) !== "true") return;
    const raw = localStorage.getItem(ENRICHMENT_RESULTS_KEY);
    if (!raw) {
      localStorage.removeItem(OPEN_RESULTS_FLAG);
      return;
    }
    try {
      const data = JSON.parse(raw) as {
        contacts?: unknown[];
        filename?: string;
        savedAt?: string;
      };
      if (data.savedAt) {
        const ageMs = Date.now() - new Date(data.savedAt).getTime();
        if (ageMs > 60 * 60 * 1000) {
          localStorage.removeItem(OPEN_RESULTS_FLAG);
          return;
        }
      }
      if (!data.contacts || !Array.isArray(data.contacts)) {
        localStorage.removeItem(OPEN_RESULTS_FLAG);
        return;
      }
      const job = readEnrichmentJob() as {
        eventId?: string | null;
        eventName?: string;
        id?: number;
      } | null;
      const jid = typeof job?.id === "number" ? job.id : Date.now();
      const withIds: EnrichedRow[] = data.contacts.map((c: unknown, i: number) => {
        const row = c as EnrichedRow;
        return {
          ...row,
          __id: row.__id || `row-${jid}-${i}`,
          icp_fit_score: Number(row.icp_fit_score) || 0,
          suggested_lead_score: Number(row.suggested_lead_score) || 5,
          icp_fit_reason: typeof row.icp_fit_reason === "string" ? row.icp_fit_reason : "",
          summary: typeof row.summary === "string" ? row.summary : "",
          talking_points: Array.isArray(row.talking_points) ? row.talking_points : [],
          red_flags: Array.isArray(row.red_flags) ? row.red_flags : [],
          ai_enrichment: (row.ai_enrichment as Record<string, unknown>) || {},
        };
      });
      setResultsModal({
        filename: data.filename || "leads.csv",
        eventId: job?.eventId ?? null,
        eventName: job?.eventName || "No specific event",
        contacts: withIds,
      });
      setSelectedIds(withIds.filter((c) => (c.icp_fit_score ?? 0) >= 5).map((c) => c.__id));
    } catch {
      /* ignore */
    }
    localStorage.removeItem(OPEN_RESULTS_FLAG);
  }, []);

  useEffect(() => {
    if (pathname === "/leads") openModalFromResultsFlag();
  }, [pathname, openModalFromResultsFlag]);

  const openFilePicker = () => fileInputRef.current?.click();

  const clearCsvSelection = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setResultsModal(null);
    setSelectedIds([]);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setSelectedFile(f ?? null);
    e.target.value = "";
  };

  const sortedModalContacts = useMemo(() => {
    if (!resultsModal) return [];
    return [...resultsModal.contacts].sort((a, b) => (b.icp_fit_score ?? 0) - (a.icp_fit_score ?? 0));
  }, [resultsModal]);

  const dist = useMemo(() => distributionCounts(sortedModalContacts), [sortedModalContacts]);

  const remainingForEta = Math.max(0, scoringTotal - scoringCurrent + 1);
  const etaSeconds = Math.ceil(remainingForEta * 1.5);

  const runEnrich = async () => {
    if (!user?.id || !selectedFile || listTiming === null) return;
    const csvText = await selectedFile.text();
    const parsed = parseCSV(csvText);
    if (parsed.length < 2) {
      showToast("Could not parse this CSV — add headers and at least one row.", "error");
      return;
    }
    const dataRows = parsed.length - 1;
    const cappedForEta = Math.min(dataRows, 100);
    const eventName =
      selectedEventId === ""
        ? "No specific event"
        : events.find((ev) => ev.id === selectedEventId)?.name || "Event";
    const filename = selectedFile.name;
    setScoringTotal(cappedForEta);
    setScoringCurrent(0);
    setBarProgress(0);
    setProgressText(`Scoring contact 0 of ${cappedForEta} against your ICP...`);
    setEnrichLoading(true);

    const jobId = Date.now();
    writeEnrichmentJobFull({
      id: jobId,
      filename,
      totalContacts: cappedForEta,
      startedAt: new Date().toISOString(),
      status: "processing",
      progress: 0,
      processed: 0,
      progressText: `Scoring contact 0 of ${cappedForEta} against your ICP...`,
      eventId: selectedEventId || null,
      eventName,
    });

    try {
      const response = await fetch("/api/enrich-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText,
          userId: user.id,
          eventId: selectedEventId || undefined,
          listTiming,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        let msg = "Enrichment failed — try again.";
        try {
          const j = JSON.parse(text) as { error?: string; message?: string };
          if (j.error === "no_valid_rows" && typeof j.message === "string") msg = j.message;
          else if (typeof j.message === "string") msg = j.message;
        } catch {
          /* ignore */
        }
        patchEnrichmentJob({
          status: "error",
          errorMessage: msg,
          progress: 100,
        });
        if (mountedRef.current) showToast(msg, "error");
        return;
      }

      const body = response.body;
      if (!body) {
        patchEnrichmentJob({
          status: "error",
          errorMessage: "Enrichment failed — try again.",
          progress: 100,
        });
        if (mountedRef.current) showToast("Enrichment failed — try again.", "error");
        return;
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as {
              type: string;
              current?: number;
              total?: number;
              contact?: unknown;
              contacts?: unknown[];
              message?: string;
              truncated?: boolean;
              totalRows?: number;
            };
            if (event.type === "progress") {
              const cur = event.current ?? 0;
              const tot = event.total ?? 1;
              const realProgress = Math.round((cur / tot) * 100);
              const line = `Scoring contact ${cur} of ${tot} against your ICP...`;
              patchEnrichmentJob({
                progress: realProgress,
                processed: cur,
                totalContacts: tot,
                progressText: line,
              });
              if (mountedRef.current) {
                setBarProgress(realProgress);
                setScoringCurrent(cur);
                setScoringTotal(tot);
                setProgressText(line);
              }
            } else if (event.type === "done" && Array.isArray(event.contacts)) {
              const enriched = event.contacts;
              localStorage.setItem(
                ENRICHMENT_RESULTS_KEY,
                JSON.stringify({
                  contacts: enriched,
                  savedAt: new Date().toISOString(),
                  filename,
                  truncated: event.truncated ?? false,
                  totalRows: event.totalRows ?? enriched.length,
                })
              );
              const jobCur = readEnrichmentJob() || {};
              writeEnrichmentJobFull({
                ...jobCur,
                status: "complete",
                progress: 100,
                results: enriched,
                filename,
                eventId: selectedEventId || null,
                eventName,
              });
              const withIds = mapRawContactsToEnrichedRows(enriched, jobId);
              if (mountedRef.current) {
                setBarProgress(100);
                setScoringCurrent(withIds.length);
                setScoringTotal(withIds.length);
                setResultsModal({
                  filename,
                  eventId: selectedEventId || null,
                  eventName,
                  contacts: withIds,
                });
                setSelectedIds(withIds.filter((c) => (c.icp_fit_score ?? 0) >= 5).map((c) => c.__id));
              }
            } else if (event.type === "error") {
              const em = typeof event.message === "string" ? event.message : "Enrichment failed — try again.";
              patchEnrichmentJob({
                status: "error",
                errorMessage: em,
                progress: 100,
              });
              if (mountedRef.current) showToast(em, "error");
            }
          } catch (e) {
            console.error("Parse error on line:", line, e);
          }
        }
      }
    } finally {
      if (mountedRef.current) {
        setEnrichLoading(false);
        setProgressText("");
      }
    }
  };

  const toggleId = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllToggle = () => {
    if (!resultsModal) return;
    const all = sortedModalContacts.map((c) => c.__id);
    if (selectedIds.length === all.length) setSelectedIds([]);
    else setSelectedIds(all);
  };

  const closeModal = () => {
    setResultsModal(null);
    setSelectedIds([]);
  };

  const saveSelected = async () => {
    if (!user?.id || !resultsModal) return;
    const rows = sortedModalContacts.filter((c) => selectedIds.includes(c.__id));
    if (!rows.length) {
      showToast("No contacts selected", "error");
      return;
    }
    setSaving(true);
    const eventId = resultsModal.eventId;
    const inserts = rows.map((contact) =>
      supabase.from("contacts").insert({
        user_id: user.id,
        name: contact.name || null,
        title: contact.title || null,
        company: contact.company || null,
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        linkedin: contact.linkedin ?? "",
        event: eventId || null,
        lead_score: contact.suggested_lead_score ?? 5,
        ai_enrichment: contact.ai_enrichment,
        enriched: true,
        enriched_at: new Date().toISOString(),
        checks: [],
        source: "lead_list",
        status: contact.status === "captured" ? "captured" : "prospect",
      })
    );
    const outcomes = await Promise.all(inserts.map((p) => p.then((r) => ({ error: r.error }))));
    const failed = outcomes.filter((o) => o.error).length;
    const saved = outcomes.length - failed;
    setSaving(false);
    if (saved > 0 && failed === 0) {
      showToast(`${saved} contacts saved`, "success");
      const topScore = Math.max(...resultsModal.contacts.map((c) => c.icp_fit_score || 0), 0);
      const entry: StoredLeadList = {
        id: Date.now(),
        filename: resultsModal.filename,
        uploadDate: new Date().toISOString(),
        contactCount: resultsModal.contacts.length,
        savedCount: saved,
        eventName: resultsModal.eventName || "No event",
        eventId: resultsModal.eventId,
        topScore,
        contacts: resultsModal.contacts,
      };
      const next = [entry, ...readStoredLists()];
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      setPastLists(next);
      closeModal();
    } else if (saved > 0 && failed > 0) {
      showToast(`${saved} saved, ${failed} failed`, "error");
    } else {
      showToast("Save failed — try again", "error");
    }
  };

  const openPastList = (list: StoredLeadList) => {
    const contacts = list.contacts.map((c, i) => ({
      ...c,
      __id: c.__id || `stored-${list.id}-${i}`,
    }));
    setResultsModal({
      filename: list.filename,
      eventId: list.eventId,
      eventName: list.eventName,
      contacts,
    });
    setSelectedIds(contacts.filter((c) => (c.icp_fit_score ?? 0) >= 6).map((c) => c.__id));
  };

  const deletePastList = async (list: StoredLeadList) => {
    if (!window.confirm("Delete this lead list?")) return;
    const { error } = await supabase.from("lead_list").delete().eq("id", list.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    const next = pastLists.filter((l) => l.id !== list.id);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    setPastLists(next);
  };

  if (!user) {
    return <div style={{ minHeight: "100vh", background: "#f0f2f0" }} />;
  }

  return (
    <div
      style={{
        padding: "24px 24px 32px",
        maxWidth: "100%",
        backgroundColor: "#f0f2f0",
        minHeight: "100vh",
        boxSizing: "border-box",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 2000,
            padding: "12px 18px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
            background: toast.variant === "success" ? "#1a3a2a" : "#fef2f2",
            color: toast.variant === "success" ? "#fff" : "#b91c1c",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: "#111",
            margin: 0,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Lead Lists
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "#999",
            marginTop: 4,
            marginBottom: 0,
            maxWidth: 520,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Upload an attendee list and Katch will score every contact against your ICP.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 340px",
          gap: 24,
          alignItems: "start",
        }}
      >
      <div
        style={{
          background: "rgba(255,255,255,0.6)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 14,
          padding: 28,
          position: "relative",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {enrichLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.92)",
              borderRadius: 14,
              zIndex: 5,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div style={{ width: "100%", maxWidth: 360, height: 6, borderRadius: 99, background: "#f0f0f0", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${barProgress}%`,
                  background: "#1a3a2a",
                  borderRadius: 99,
                  transition: "width 0.15s linear",
                }}
              />
            </div>
            <p style={{ fontSize: 13, color: "#666", marginTop: 16, textAlign: "center" }}>
              {progressText ||
                `Scoring contact ${scoringCurrent} of ${scoringTotal} against your ICP...`}
            </p>
            <p style={{ fontSize: 12, color: "#999", marginTop: 6 }}>
              ~{formatTime(etaSeconds)} remaining
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={onFileChange}
        />

        <div
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") openFilePicker();
          }}
          onMouseEnter={() => setIsDropZoneHover(true)}
          onMouseLeave={() => setIsDropZoneHover(false)}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragDepthRef.current += 1;
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragDepthRef.current -= 1;
            if (dragDepthRef.current <= 0) {
              dragDepthRef.current = 0;
              setIsDragging(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dragDepthRef.current = 0;
            setIsDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f && f.name.toLowerCase().endsWith(".csv")) setSelectedFile(f);
          }}
          style={{
            background: isDragging || isDropZoneHover ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.5)",
            border: "2px dashed",
            borderColor: isDragging || isDropZoneHover ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.1)",
            borderRadius: 12,
            minHeight: 220,
            boxSizing: "border-box",
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            cursor: "pointer",
            transition: "border-color 0.2s, background 0.2s",
            overflow: "hidden",
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            style={{ display: "block", margin: "0 auto 8px", flexShrink: 0 }}
            aria-hidden
          >
            <path
              d="M12 4v12M8 8l4-4 4 4"
              stroke="#999"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
              stroke="#999"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <div style={{ fontSize: 15, fontWeight: 500, color: "#111", marginBottom: 4, flexShrink: 0 }}>
            Drop a CSV file here
          </div>
          <div style={{ fontSize: 13, color: "#999", marginBottom: 8, flexShrink: 0 }}>or</div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openFilePicker();
            }}
            style={{
              background: "#fff",
              border: "1px solid #e8e8e8",
              color: "#111",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Browse files
          </button>
        </div>

        {selectedFile && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 }}>
            <span style={{ color: "#2d6a1f", fontSize: 18 }}>✓</span>
            <span style={{ fontSize: 13, color: "#333" }}>
              {selectedFile.name} ({formatBytes(selectedFile.size)})
            </span>
            <button
              type="button"
              onClick={clearCsvSelection}
              aria-label="Clear CSV file"
              style={{
                background: "transparent",
                border: "none",
                color: "#999",
                fontSize: 16,
                cursor: "pointer",
                marginLeft: 8,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        )}

        {selectedFile && (
          <div style={{ marginTop: 20, width: "100%" }}>
            <div
              style={{
                fontSize: 13,
                color: "#111",
                marginBottom: 10,
                fontFamily: "Inter, sans-serif",
              }}
            >
              When are you uploading this list?
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={() => setListTiming("pre")}
                style={{
                  background: listTiming === "pre" ? "#1a3a2a" : "#fff",
                  color: listTiming === "pre" ? "#fff" : "#111",
                  border: listTiming === "pre" ? "1px solid #1a3a2a" : "1px solid #e8e8e8",
                  borderRadius: 100,
                  padding: "8px 18px",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Before the event
              </button>
              <button
                type="button"
                onClick={() => setListTiming("post")}
                style={{
                  background: listTiming === "post" ? "#1a3a2a" : "#fff",
                  color: listTiming === "post" ? "#fff" : "#111",
                  border: listTiming === "post" ? "1px solid #1a3a2a" : "1px solid #e8e8e8",
                  borderRadius: 100,
                  padding: "8px 18px",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                After the event
              </button>
            </div>
          </div>
        )}

        <p style={{ fontSize: 12, color: "#999", marginTop: 12, textAlign: "center" }}>
          CSV should include name, email, company, and title columns. Katch will figure out the column mapping automatically.
        </p>

        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>Associate with event (optional)</div>
          <div ref={eventDropdownRef} style={{ position: "relative", width: 280 }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsDropdownOpen((o) => !o)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsDropdownOpen((o) => !o);
                }
              }}
              style={{
                background: "#fff",
                border: "1px solid #e8e8e8",
                borderRadius: 10,
                padding: "9px 14px",
                fontSize: 14,
                color: "#111",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: 280,
                boxSizing: "border-box",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedEventLabel}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginLeft: 8 }}>
                <path
                  d="M6 9l6 6 6-6"
                  stroke="#666"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            {isDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  width: "100%",
                  background: "#fff",
                  border: "1px solid #e8e8e8",
                  borderRadius: 10,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                  zIndex: 100,
                  marginTop: 4,
                  maxHeight: 240,
                  overflowY: "auto",
                  boxSizing: "border-box",
                }}
              >
                <div
                  role="option"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedEventId("");
                    setIsDropdownOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedEventId("");
                      setIsDropdownOpen(false);
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f5f5f5";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                  style={{ padding: "10px 14px", fontSize: 14, color: "#111", cursor: "pointer" }}
                >
                  No specific event
                </div>
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    role="option"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedEventId(ev.id);
                      setIsDropdownOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setSelectedEventId(ev.id);
                        setIsDropdownOpen(false);
                      }
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f5f5f5";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                    style={{ padding: "10px 14px", fontSize: 14, color: "#111", cursor: "pointer" }}
                  >
                    {ev.name || "Untitled event"}
                  </div>
                ))}
                <div style={{ height: 1, background: "#ebebeb", margin: "4px 0" }} />
                <div
                  role="option"
                  tabIndex={0}
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setShowCreateForm(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setIsDropdownOpen(false);
                      setShowCreateForm(true);
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f0f7eb";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                  style={{
                    padding: "10px 14px",
                    fontSize: 14,
                    color: "#1a3a2a",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  + Create new event
                </div>
              </div>
            )}
            {showCreateForm && (
              <div style={{ marginTop: 12 }}>
                <input
                  type="text"
                  placeholder="Event name"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  style={{
                    border: "1px solid #e8e8e8",
                    borderRadius: 10,
                    padding: "9px 14px",
                    fontSize: 14,
                    width: 280,
                    outline: "none",
                    display: "block",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#1a3a2a";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#e8e8e8";
                  }}
                />
                <input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  style={{
                    border: "1px solid #e8e8e8",
                    borderRadius: 10,
                    padding: "9px 14px",
                    fontSize: 14,
                    width: 280,
                    outline: "none",
                    display: "block",
                    marginTop: 8,
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#1a3a2a";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#e8e8e8";
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", marginTop: 10 }}>
                  <button
                    type="button"
                    disabled={isCreatingEvent}
                    onClick={() => void handleCreateEventSubmit()}
                    style={{
                      background: "#1a3a2a",
                      color: "#fff",
                      borderRadius: 8,
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: isCreatingEvent ? "not-allowed" : "pointer",
                      border: "none",
                      opacity: isCreatingEvent ? 0.7 : 1,
                    }}
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewEventName("");
                      setNewEventDate("");
                      setCreateEventNotice(null);
                    }}
                    style={{
                      color: "#999",
                      fontSize: 13,
                      cursor: "pointer",
                      marginLeft: 12,
                      background: "none",
                      border: "none",
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {createEventNotice && (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 12,
                      color: createEventNotice.kind === "ok" ? "#2d6a1f" : "#e55a5a",
                    }}
                  >
                    {createEventNotice.text}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={!selectedFile || enrichLoading || listTiming === null}
          onClick={() => void runEnrich()}
          style={{
            width: "100%",
            marginTop: 20,
            background: !selectedFile || enrichLoading || listTiming === null ? "#ccc" : "#1a3a2a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 13,
            fontWeight: 500,
            cursor: !selectedFile || enrichLoading || listTiming === null ? "not-allowed" : "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Score & Rank Leads
        </button>
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            color: "#999",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 600,
            marginBottom: 8,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Past lead lists
        </div>
        {pastLists.length === 0 ? (
          <p style={{ color: "#999", fontSize: 13, textAlign: "center", padding: 32, margin: 0 }}>
            No lead lists uploaded yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {pastLists.map((list) => (
              <div
                key={list.id}
                style={{
                  background: "rgba(255,255,255,0.6)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#111",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={list.filename}
                  >
                    {list.filename}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#999",
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={`${list.eventName} · ${formatTableDate(list.uploadDate)} · ${list.contactCount} contact${list.contactCount === 1 ? "" : "s"} · Top ICP ${list.topScore}/10`}
                  >
                    {`${list.eventName} · ${formatTableDate(list.uploadDate)} · ${list.contactCount} contact${list.contactCount === 1 ? "" : "s"} · Top ICP ${list.topScore}/10`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => openPastList(list)}
                    style={{
                      fontSize: 12,
                      color: "#1a3a2a",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 400,
                      padding: 0,
                      margin: 0,
                      fontFamily: "Inter, sans-serif",
                      textDecoration: "none",
                      boxShadow: "none",
                      alignSelf: "center",
                    }}
                  >
                    View results
                  </button>
                  <button
                    type="button"
                    aria-label="Delete lead list"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deletePastList(list);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 2,
                      margin: 0,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <X size={14} color="#999" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {resultsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 32,
            paddingBottom: 32,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              width: 760,
              maxWidth: "95vw",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #ebebeb",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>Lead Scoring Results</div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                    {sortedModalContacts.length} contacts scored — sorted by ICP fit
                  </div>
                  <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                    {dist.high} high fit (7-10) · {dist.med} medium (4-6) · {dist.low} low (1-3)
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={selectAllToggle}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#1a3a2a",
                      fontSize: 13,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Select all
                  </button>
                  <span style={{ fontSize: 12, color: "#666", marginLeft: 12 }}>
                    {selectedIds.length} of {sortedModalContacts.length} selected
                  </span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveSelected()}
                    style={{
                      background: "#1a3a2a",
                      color: "#fff",
                      borderRadius: 10,
                      padding: "9px 20px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: saving ? "wait" : "pointer",
                      border: "none",
                      marginLeft: 12,
                    }}
                  >
                    Save selected
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#999",
                      fontSize: 20,
                      cursor: "pointer",
                      marginLeft: 16,
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {sortedModalContacts.map((c) => {
                const sel = selectedIds.includes(c.__id);
                const pill = scorePillStyle(c.icp_fit_score ?? 0);
                const scoreVal = Math.min(10, Math.max(0, Math.round(c.icp_fit_score ?? 0)));
                return (
                  <div
                    key={c.__id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleId(c.__id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggleId(c.__id);
                    }}
                    onMouseEnter={() => setHoveredRow(c.__id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      padding: "14px 20px",
                      borderBottom: "1px solid #f5f5f5",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      cursor: "pointer",
                      background: sel ? "#f8fdf4" : hoveredRow === c.__id ? "#fafafa" : "#fff",
                    }}
                  >
                    <div
                      role="presentation"
                      onClick={(e) => e.stopPropagation()}
                      style={{ flexShrink: 0, marginTop: 2 }}
                    >
                      <div
                        role="checkbox"
                        aria-checked={sel}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleId(c.__id);
                        }}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: sel ? "1.5px solid #1a3a2a" : "1.5px solid #d0d0d0",
                          background: sel ? "#1a3a2a" : "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {sel && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{c.name || "—"}</div>
                      <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>
                        {[c.title, c.company].filter(Boolean).join(" · ") || "—"}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#bbb",
                          marginTop: 3,
                          maxWidth: 380,
                          lineHeight: 1.35,
                        }}
                      >
                        {c.icp_fit_reason || "—"}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: 99,
                          color: pill.color,
                          background: pill.background,
                        }}
                      >
                        {scoreVal}/10
                      </span>
                      <span style={{ fontSize: 11, color: "#999" }}>
                        Lead score: {c.suggested_lead_score ?? "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
