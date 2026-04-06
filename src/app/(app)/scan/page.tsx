"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, User as UserIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { findDuplicateContact } from "@/lib/duplicates";
import { DEFAULT_SIGNAL_LABELS } from "@/lib/katch-constants";

async function fetchLeadListProspectId(
  userId: string,
  emailRaw: string | null | undefined
): Promise<string | null> {
  const em = (emailRaw ?? "").trim();
  if (!em) return null;
  const { data, error } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "lead_list")
    .eq("status", "prospect")
    .ilike("email", em);
  if (error || !data?.[0]?.id) return null;
  return data[0].id as string;
}

async function mergeLeadListProspectIfExists(
  userId: string,
  email: string | null | undefined,
  patch: Record<string, unknown>
): Promise<"merged" | "no_match" | "failed"> {
  const prospectId = await fetchLeadListProspectId(userId, email);
  if (!prospectId) return "no_match";
  const { error } = await supabase.from("contacts").update(patch).eq("id", prospectId);
  if (error) {
    console.error("mergeLeadListProspectIfExists", error);
    return "failed";
  }
  return "merged";
}

async function uploadDataUrlAsContactImage(
  sessionUser: User,
  dataUrl: string | null,
  fileSuffix: string
): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;
  try {
    const arr = dataUrl.split(",");
    if (arr.length !== 2) return null;
    const mimeMatch = arr[0].match(/data:(.*?);base64/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const file = new File([u8arr], "contact-image.jpg", { type: mime });
    const filePath = `contacts/${sessionUser.id}/${Date.now()}-${fileSuffix}.jpg`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
      upsert: false,
    });
    if (uploadError) return null;
    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    return publicData?.publicUrl ?? null;
  } catch {
    return null;
  }
}

type DuplicateExistingContact = {
  id: string;
  name?: string | null;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  lead_score?: number | null;
  checks?: string[] | null;
  free_note?: string | null;
  event?: string | null;
  image?: string | null;
  enriched?: boolean | null;
};

type DuplicateNewContact = {
  name?: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  lead_score?: number;
  checks?: string[];
  free_note?: string;
  event?: string;
  enriched?: boolean;
};

const BULK_REVIEW_DEFAULT_SIGNALS = [
  "Wants a demo",
  "Budget approved",
  "Active buying timeline",
  "They asked me to follow up",
];

export default function ScanPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [toastColors, setToastColors] = useState({ background: "#1a3a2a", color: "#fff" });
  const [signalLabels, setSignalLabels] = useState<string[]>(DEFAULT_SIGNAL_LABELS);

  const [scanMode, setScanMode] = useState("idle");
  const [extracted, setExtracted] = useState<any>(null);
  const [singleEnrichment, setSingleEnrichment] = useState<Record<string, unknown> | null>(null);
  const [singlePanelEnriching, setSinglePanelEnriching] = useState(false);
  const [singleEnrichError, setSingleEnrichError] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [freeNote, setFreeNote] = useState("");
  const [leadScore, setLeadScore] = useState(1);
  const [eventTag, setEventTag] = useState("");
  const [showReviewNewEventForm, setShowReviewNewEventForm] = useState(false);
  const [reviewNewEventName, setReviewNewEventName] = useState("");
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<
    Array<{
      id: string;
      dataUrl: string;
      status: "pending" | "scanning" | "retrying" | "done" | "failed";
      contact: any | null;
      failureReason?: "scan_failed" | "timeout" | "other";
    }>
  >([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewData, setReviewData] = useState<
    Record<string, { lead_score: number; checks: string[]; free_note: string }>
  >({});
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventName, setSelectedEventName] = useState("");
  const [eventPickerHoverKey, setEventPickerHoverKey] = useState<string | null>(null);
  const [showNewEventInput, setShowNewEventInput] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [showBulkDiscard, setShowBulkDiscard] = useState(false);
  const [isHoveringCancel, setIsHoveringCancel] = useState(false);
  const [enrichingIndex, setEnrichingIndex] = useState<number | null>(null);
  const [contactEnrichments, setContactEnrichments] = useState<Record<number, any>>({});
  const [enrichmentExpanded, setEnrichmentExpanded] = useState<Record<number, boolean>>({});
  const [enrichErrorIndex, setEnrichErrorIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<Array<{ id: string; dataUrl: string; file: File }>>([]);
  const [duplicateModal, setDuplicateModal] = useState<{
    show: boolean;
    existingContact: DuplicateExistingContact | null;
    newContact: DuplicateNewContact | null;
    imageFile: File | null;
  }>({ show: false, existingContact: null, newContact: null, imageFile: null });
  const [saving, setSaving] = useState(false);
  const [saveContactFeedback, setSaveContactFeedback] = useState<null | "success" | "error">(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const singleUploadInputRef = useRef<HTMLInputElement>(null);
  const stagedAddInputRef = useRef<HTMLInputElement>(null);
  const stagedFilesRef = useRef(stagedFiles);
  stagedFilesRef.current = stagedFiles;
  const bulkProcessCancelRequestedRef = useRef(false);
  const scanStartTime = useRef<number>(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(data.session.user as User);
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("events")
      .select("id, name, date, location")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .then(({ data }) => {
        if (data) setEvents((data as any[]) || []);
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("user_settings")
      .select("signals")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.signals && Array.isArray(data.signals)) {
          const enabled = (data.signals as any[])
            .filter((s) => s && s.enabled !== false)
            .map((s) => (typeof s.name === "string" ? s.name : ""))
            .filter(Boolean);
          if (enabled.length) {
            setSignalLabels(enabled);
          }
        }
      });
  }, [user?.id]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("katch_scan_draft");
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && Date.now() - draft.timestamp < 24 * 60 * 60 * 1000) {
          setUploadedImage(draft.imageDataUrl);
          setExtracted(draft.contactResult);
          setSingleEnrichment(null);
          setSingleEnrichError(false);
          setScanMode("review");
          setRestoredDraft(true);
        }
      }
    } catch (e) {}
  }, []);

  const showToast = (msg: string, colors?: { background: string; color: string }) => {
    setToast(msg);
    setToastColors(colors ?? { background: "#1a3a2a", color: "#fff" });
    setTimeout(() => setToast(null), 2500);
  };

  const resetScan = () => {
    setScanMode("idle");
    setExtracted(null);
    setSingleEnrichment(null);
    setSinglePanelEnriching(false);
    setSingleEnrichError(false);
    setUploadedImage(null);
    setChecks({});
    setFreeNote("");
    setLeadScore(1);
    setEventTag("");
    setShowReviewNewEventForm(false);
    setReviewNewEventName("");
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    try {
      localStorage.removeItem("katch_scan_draft");
    } catch (e) {}
    setStagedFiles([]);
    setSaving(false);
    setSaveContactFeedback(null);
  };

  const handleBulkProcess = async (
    filesOverride?: Array<{
      id: string;
      dataUrl: string;
      status: "pending" | "scanning" | "retrying" | "done" | "failed";
      contact: any | null;
      failureReason?: "scan_failed" | "timeout" | "other";
    }>
  ) => {
    bulkProcessCancelRequestedRef.current = false;
    const queue = filesOverride ?? bulkFiles;
    scanStartTime.current = Date.now();
    setBulkProcessing(true);
    let scanFailedExtractCount = 0;
    const retryQueue: number[] = [];
    for (let i = 0; i < queue.length; i++) {
      if (bulkProcessCancelRequestedRef.current) break;
      const item = queue[i];
      if (item.status !== "pending") continue;
      setBulkFiles((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: "scanning" } : x)));
      setBulkProgress(i + 1);
      try {
        const base64 = item.dataUrl.split(",")[1];
        const mediaType = item.dataUrl.split(";")[0].split(":")[1];
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType, userId: user?.id }),
        });
        if (bulkProcessCancelRequestedRef.current) break;
        const data = await res.json();
        if (bulkProcessCancelRequestedRef.current) break;
        if (data?.error === "failed") {
          const isTimeout = data.reason === "timeout";
          if (isTimeout) {
            retryQueue.push(i);
            setBulkFiles((prev) =>
              prev.map((x) =>
                x.id === item.id
                  ? { ...x, status: "retrying" as const, contact: null, failureReason: "timeout" as const }
                  : x
              )
            );
            continue;
          }
          scanFailedExtractCount += 1;
          setBulkFiles((prev) =>
            prev.map((x) =>
              x.id === item.id
                ? { ...x, status: "failed" as const, contact: null, failureReason: "scan_failed" as const }
                : x
            )
          );
          continue;
        }
        if (res.status === 422 && data.error === "scan_failed") {
          scanFailedExtractCount += 1;
          setBulkFiles((prev) =>
            prev.map((x) =>
              x.id === item.id
                ? { ...x, status: "failed" as const, contact: null, failureReason: "scan_failed" as const }
                : x
            )
          );
          continue;
        }
        setBulkFiles((prev) =>
          prev.map((x) =>
            x.id === item.id
              ? {
                  ...x,
                  status: data.contact ? ("done" as const) : ("failed" as const),
                  contact: data.contact || null,
                  ...(data.contact ? {} : { failureReason: "other" as const }),
                }
              : x
          )
        );
      } catch {
        if (bulkProcessCancelRequestedRef.current) break;
        setBulkFiles((prev) =>
          prev.map((x) =>
            x.id === item.id
              ? { ...x, status: "failed" as const, contact: null, failureReason: "other" as const }
              : x
          )
        );
      }
    }

    for (const idx of retryQueue) {
      if (bulkProcessCancelRequestedRef.current) break;
      const item = queue[idx];
      if (!item) continue;
      setBulkFiles((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: "scanning" } : x)));
      try {
        const base64 = item.dataUrl.split(",")[1];
        const mediaType = item.dataUrl.split(";")[0].split(":")[1];
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mediaType, userId: user?.id }),
        });
        if (bulkProcessCancelRequestedRef.current) break;
        const data = await res.json();
        if (bulkProcessCancelRequestedRef.current) break;
        if (data?.contact) {
          setBulkFiles((prev) =>
            prev.map((x) =>
              x.id === item.id
                ? {
                    ...x,
                    status: "done" as const,
                    contact: data.contact,
                    failureReason: undefined,
                  }
                : x
            )
          );
        } else {
          setBulkFiles((prev) =>
            prev.map((x) =>
              x.id === item.id
                ? { ...x, status: "failed" as const, contact: null, failureReason: "scan_failed" as const }
                : x
            )
          );
        }
      } catch {
        if (bulkProcessCancelRequestedRef.current) break;
        setBulkFiles((prev) =>
          prev.map((x) =>
            x.id === item.id
              ? { ...x, status: "failed" as const, contact: null, failureReason: "scan_failed" as const }
              : x
          )
        );
      }
    }
    const cancelled = bulkProcessCancelRequestedRef.current;
    bulkProcessCancelRequestedRef.current = false;
    setBulkProcessing(false);
    if (!cancelled && scanFailedExtractCount > 0) {
      showToast(
        `${scanFailedExtractCount} photo(s) couldn't be scanned — try clearer images`,
        { background: "#e55a5a", color: "#fff" }
      );
    }
  };

  const cancelScanning = () => {
    bulkProcessCancelRequestedRef.current = true;
    setBulkMode(false);
    setBulkFiles([]);
    setBulkProcessing(false);
    setBulkProgress(0);
    setStagedFiles([]);
    setIsReviewing(false);
    setReviewIndex(0);
    setReviewData({});
    setShowEventPicker(false);
    setSelectedEventId(null);
    setShowNewEventInput(false);
    setNewEventName("");
    setNewEventDate("");
    setEnrichingIndex(null);
    setContactEnrichments({});
    setEnrichmentExpanded({});
    setEnrichErrorIndex(null);
  };

  const handleBulkReviewEnrich = async (
    currentReviewIndex: number,
    contact: any,
    reviewContactId?: string
  ) => {
    if (!user?.id || !contact) return;
    setEnrichingIndex(currentReviewIndex);
    setEnrichErrorIndex(null);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          contact: {
            name: contact.name,
            title: contact.title,
            company: contact.company,
            email: contact.email,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error("enrich failed");
      const result = (data.enrichment as Record<string, unknown>) || null;
      setContactEnrichments((prev) => ({ ...prev, [currentReviewIndex]: result }));
      setEnrichmentExpanded((prev) => ({ ...prev, [currentReviewIndex]: false }));
      const suggestedRaw = result?.suggested_lead_score;
      const suggested =
        typeof suggestedRaw === "number"
          ? suggestedRaw
          : typeof suggestedRaw === "string"
            ? Number(suggestedRaw)
            : null;
      const suggestedScore =
        suggested != null && Number.isFinite(suggested)
          ? Math.min(10, Math.max(1, Math.round(suggested)))
          : null;
      if (reviewContactId && suggestedScore != null) {
        setReviewData((prev) => ({
          ...prev,
          [reviewContactId]: {
            ...(prev[reviewContactId] ?? { lead_score: 5, checks: [], free_note: "" }),
            lead_score: suggestedScore,
          },
        }));
      }
    } catch {
      setEnrichErrorIndex(currentReviewIndex);
    } finally {
      setEnrichingIndex(null);
    }
  };

  const saveContact = async (
    item: {
      id: string;
      dataUrl: string;
      status: "pending" | "scanning" | "retrying" | "done" | "failed";
      contact: any;
      failureReason?: "scan_failed" | "timeout" | "other";
    },
    sessionUser: User,
    eventId: string | null,
    reviewItemIndex: number
  ): Promise<"inserted" | "merged"> => {
    const imageUrl = await uploadDataUrlAsContactImage(sessionUser, item.dataUrl, item.id);
    const r = reviewData[item.id];
    const lead_score = r?.lead_score ?? 5;
    const checks = r?.checks ?? [];
    const free_note = r?.free_note ?? "";

    const enrichmentForContact = contactEnrichments[reviewItemIndex];
    const hasEnrichmentForContact =
      enrichmentForContact != null &&
      typeof enrichmentForContact === "object" &&
      !Array.isArray(enrichmentForContact);

    const mergePatch: Record<string, unknown> = {
      source: "scan",
      status: "captured",
      lead_score,
      checks,
      free_note,
      event: eventId,
      ai_enrichment: hasEnrichmentForContact ? enrichmentForContact : null,
      enriched: hasEnrichmentForContact,
      enriched_at: hasEnrichmentForContact ? new Date().toISOString() : null,
    };
    if (imageUrl) mergePatch.image = imageUrl;
    const mergeOutcome = await mergeLeadListProspectIfExists(sessionUser.id, item.contact.email, mergePatch);
    if (mergeOutcome === "failed") throw new Error("merge prospect failed");
    if (mergeOutcome === "merged") return "merged";

    const { error } = await supabase.from("contacts").insert({
      user_id: sessionUser.id,
      name: item.contact.name ?? "",
      title: item.contact.title ?? "",
      company: item.contact.company ?? "",
      email: item.contact.email ?? null,
      phone: item.contact.phone ?? null,
      linkedin: item.contact.linkedin ?? null,
      lead_score,
      checks,
      free_note,
      event: eventId,
      ai_enrichment: hasEnrichmentForContact ? enrichmentForContact : null,
      enriched: hasEnrichmentForContact,
      enriched_at: hasEnrichmentForContact ? new Date().toISOString() : null,
      image: imageUrl,
      source: "scan",
      status: "captured",
    });
    if (error) throw error;
    return "inserted";
  };

  const handleBulkSaveAll = async () => {
    setIsSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user;
      if (!sessionUser?.id) {
        setIsSaving(false);
        return;
      }
      const doneItems = bulkFiles.filter((x) => x.status === "done" && x.contact);
      const saveResults = await Promise.all(
        doneItems.map((item, index) => saveContact(item, sessionUser as User, selectedEventId ?? null, index))
      );
      const mergedN = saveResults.filter((r) => r === "merged").length;
      const insertedN = saveResults.filter((r) => r === "inserted").length;
      setBulkMode(false);
      setBulkFiles([]);
      setBulkProgress(0);
      setIsReviewing(false);
      setReviewIndex(0);
      setReviewData({});
      setShowEventPicker(false);
      setSelectedEventId(null);
      setShowNewEventInput(false);
      setNewEventName("");
      setNewEventDate("");
      setEnrichingIndex(null);
      setContactEnrichments({});
      setEnrichmentExpanded({});
      setEnrichErrorIndex(null);
      if (mergedN > 0 && insertedN > 0) {
        showToast(`${insertedN} saved, ${mergedN} matched from lead list`);
      } else if (mergedN > 0) {
        showToast(
          mergedN === 1
            ? "Matched existing prospect — contact updated."
            : `Matched ${mergedN} existing prospects — contacts updated.`
        );
      } else {
        showToast(`${insertedN} contacts saved`);
      }
      setIsSaving(false);
      router.push("/contacts");
    } catch {
      setIsSaving(false);
      showToast("Some contacts failed to save. Please try again.", {
        background: "#e55a5a",
        color: "#fff",
      });
    }
  };

  const handleOpenCamera = async () => {
    setScanMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      showToast("Camera unavailable — use photo upload");
      setScanMode("idle");
    }
  };

  const scanWithClaude = async (base64: string, mediaType: string) => {
    setSingleEnrichment(null);
    setSingleEnrichError(false);
    setSinglePanelEnriching(false);
    setScanMode("extracting");
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType, userId: user?.id }),
      });
      const data = await res.json();
      if (res.status === 422 && data.error === "scan_failed") {
        showToast(
          typeof data.message === "string"
            ? data.message
            : "Could not extract contact information from this image. Please try a clearer photo.",
          { background: "#e55a5a", color: "#fff" }
        );
        setScanMode("idle");
        return;
      }
      if (data.contact) {
        setExtracted(data.contact);
        setScanMode("review");
        try {
          const imageDataUrl = uploadedImage || `data:${mediaType};base64,${base64}`;
          localStorage.setItem(
            "katch_scan_draft",
            JSON.stringify({
              imageDataUrl,
              contactResult: data.contact,
              timestamp: Date.now(),
            })
          );
        } catch (e) {}
      } else {
        showToast("Couldn't read card — try a clearer photo");
        setScanMode("idle");
      }
    } catch {
      showToast("Scan failed — check your connection");
      setScanMode("idle");
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    const canvas = document.createElement("canvas");
    const video = videoRef.current;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = video.videoWidth * pixelRatio;
    canvas.height = video.videoHeight * pixelRatio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(pixelRatio, pixelRatio);
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    }
    const dataUrl = canvas.toDataURL("image/jpeg", 1.0);
    const base64 = dataUrl.split(",")[1];
    setUploadedImage(dataUrl);
    await scanWithClaude(base64, "image/jpeg");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      const mediaType = file.type;
      setUploadedImage(dataUrl);
      await scanWithClaude(base64, mediaType);
    };
    reader.readAsDataURL(file);
  };

  const handleSmartUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    e.target.value = "";
    if (files.length === 1) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        const mediaType = files[0].type;
        setUploadedImage(dataUrl);
        await scanWithClaude(base64, mediaType);
      };
      reader.readAsDataURL(files[0]);
    } else {
      Promise.all(
        files.slice(0, 20).map(
          (file) =>
            new Promise<{ id: string; dataUrl: string; file: File }>((resolve) => {
              const reader = new FileReader();
              reader.onload = (ev) =>
                resolve({
                  id: Math.random().toString(36).slice(2),
                  dataUrl: ev.target?.result as string,
                  file,
                });
              reader.readAsDataURL(file);
            })
        )
      ).then((staged) => {
        setStagedFiles(staged);
      });
    }
  };

  const handleStagedAddMore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length) return;
    const room = 20 - stagedFiles.length;
    if (room <= 0) return;
    const toAdd = files.slice(0, room);
    Promise.all(
      toAdd.map(
        (file) =>
          new Promise<{ id: string; dataUrl: string; file: File }>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) =>
              resolve({
                id: Math.random().toString(36).slice(2),
                dataUrl: ev.target?.result as string,
                file,
              });
            reader.readAsDataURL(file);
          })
      )
    ).then((more) => {
      setStagedFiles((prev) => [...prev, ...more]);
    });
  };

  const handleSinglePanelEnrich = async () => {
    if (!user?.id || !extracted) return;
    setSinglePanelEnriching(true);
    setSingleEnrichError(false);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          contact: {
            name: extracted.name,
            title: extracted.title,
            company: extracted.company,
            email: extracted.email,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error("enrich failed");
      setSingleEnrichment((data.enrichment as Record<string, unknown>) || null);
    } catch {
      setSingleEnrichError(true);
    } finally {
      setSinglePanelEnriching(false);
    }
  };

  const handleSaveNewEvent = async () => {
    const n = reviewNewEventName.trim();
    if (!n || !user?.id) return;
    const { data, error } = await supabase
      .from("events")
      .insert({
        name: n,
        date: new Date().toISOString().split("T")[0],
        type: "Conference",
        location: "",
        notes: "",
        attendees: [],
        user_id: user.id,
      })
      .select()
      .single();
    if (error) {
      console.error("Create event error:", JSON.stringify(error));
      showToast("Failed to create event");
      return;
    }
    setEvents((p) => [data, ...p]);
    setEventTag(n);
    setShowReviewNewEventForm(false);
    setReviewNewEventName("");
  };

  const persistScannedContact = async (
    sessionUser: User
  ): Promise<"failed" | "merged" | "inserted"> => {
    const activeChecks = signalLabels.filter((label) => checks[label]);

    const imageUrl = await uploadDataUrlAsContactImage(sessionUser, uploadedImage, "scan");

    const hasEnrichment = !!singleEnrichment;
    const mergePatch: Record<string, unknown> = {
      source: "scan",
      status: "captured",
      lead_score: leadScore,
      checks: activeChecks,
      free_note: freeNote,
      event: eventTag || "Untagged",
      ai_enrichment: singleEnrichment,
      enriched: hasEnrichment,
      enriched_at: hasEnrichment ? new Date().toISOString() : null,
    };
    if (imageUrl) mergePatch.image = imageUrl;
    const mergedProspect = await mergeLeadListProspectIfExists(sessionUser.id, extracted?.email, mergePatch);
    if (mergedProspect === "failed") {
      showToast("Failed to save contact");
      return "failed";
    }
    if (mergedProspect === "merged") {
      return "merged";
    }

    const payload: Record<string, unknown> = {
      user_id: sessionUser.id,
      name: extracted?.name ?? "",
      title: extracted?.title ?? "",
      company: extracted?.company ?? "",
      email: extracted?.email ?? null,
      phone: extracted?.phone ?? null,
      linkedin: extracted?.linkedin ?? null,
      lead_score: leadScore,
      checks: activeChecks,
      free_note: freeNote,
      event: eventTag || "Untagged",
      ai_enrichment: singleEnrichment,
      enriched: !!singleEnrichment,
      enriched_at: singleEnrichment ? new Date().toISOString() : null,
      source: "scan",
      status: "captured",
    };

    if (imageUrl) {
      payload.image = imageUrl;
    }

    try {
      const { data, error } = await supabase
        .from("contacts")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("Supabase save error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        console.error("Payload keys:", Object.keys(payload));
        showToast("Failed to save contact");
        return "failed";
      }
      if (!data) {
        console.error("Save contact: no data returned");
        showToast("Failed to save contact");
        return "failed";
      }
      return "inserted";
    } catch (err) {
      console.error("Full error:", err);
      showToast("Failed to save contact");
      return "failed";
    }
  };

  const handleSaveContact = async () => {
    if (saving || saveContactFeedback) return;

    const failSaveUi = () => {
      setSaving(false);
      setSaveContactFeedback("error");
      window.setTimeout(() => setSaveContactFeedback(null), 1200);
    };

    const succeedSaveUi = (after: () => void) => {
      setSaving(false);
      setSaveContactFeedback("success");
      window.setTimeout(() => {
        setSaveContactFeedback(null);
        after();
      }, 1200);
    };

    setSaving(true);
    setSaveContactFeedback(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user;
      if (!sessionUser?.id) {
        console.error("Save contact: no session user");
        showToast("Failed to save contact");
        failSaveUi();
        return;
      }

      const activeChecks = signalLabels.filter((label) => checks[label]);
      const imageUrlEarly = await uploadDataUrlAsContactImage(sessionUser as User, uploadedImage, "scan");
      const hasEnrichmentEarly = !!singleEnrichment;
      const mergePatchEarly: Record<string, unknown> = {
        source: "scan",
        status: "captured",
        lead_score: leadScore,
        checks: activeChecks,
        free_note: freeNote,
        event: eventTag || "Untagged",
        ai_enrichment: singleEnrichment,
        enriched: hasEnrichmentEarly,
        enriched_at: hasEnrichmentEarly ? new Date().toISOString() : null,
      };
      if (imageUrlEarly) mergePatchEarly.image = imageUrlEarly;
      const mergedEarly = await mergeLeadListProspectIfExists(sessionUser.id, extracted?.email, mergePatchEarly);
      if (mergedEarly === "failed") {
        showToast("Failed to save contact");
        failSaveUi();
        return;
      }
      if (mergedEarly === "merged") {
        succeedSaveUi(() => {
          showToast("Matched existing prospect — contact updated.");
          resetScan();
          router.push("/contacts");
        });
        return;
      }

      const dup = await findDuplicateContact(
        extracted?.name ?? "",
        extracted?.email ?? "",
        sessionUser.id
      );
      if (dup) {
        let imageFile: File | null = null;
        if (uploadedImage && uploadedImage.startsWith("data:")) {
          try {
            const arr = uploadedImage.split(",");
            if (arr.length === 2) {
              const mimeMatch = arr[0].match(/data:(.*?);base64/);
              const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
              const bstr = atob(arr[1]);
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
              }
              imageFile = new File([u8arr], "contact-image.jpg", { type: mime });
            }
          } catch {
            imageFile = null;
          }
        }
        setDuplicateModal({
          show: true,
          existingContact: dup,
          newContact: {
            name: extracted?.name ?? "",
            title: extracted?.title ?? "",
            company: extracted?.company ?? "",
            email: extracted?.email ?? "",
            phone: extracted?.phone ?? "",
            linkedin: extracted?.linkedin ?? "",
            lead_score: leadScore,
            checks: activeChecks,
            free_note: freeNote,
            event: eventTag || "Untagged",
            enriched: !!singleEnrichment,
          },
          imageFile,
        });
        setSaving(false);
        return;
      }

      const result = await persistScannedContact(sessionUser as User);
      if (result === "failed") {
        failSaveUi();
        return;
      }
      succeedSaveUi(() => {
        if (result === "merged") {
          showToast("Matched existing prospect — contact updated.");
        } else {
          showToast("Contact saved");
        }
        resetScan();
        router.push("/contacts");
      });
    } catch {
      showToast("Failed to save contact");
      failSaveUi();
    }
  };

  const handleDuplicateMerge = async () => {
    const { existingContact, newContact, imageFile } = duplicateModal;
    if (!existingContact?.id || !newContact) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData.session?.user;
    if (!sessionUser?.id) {
      showToast("Failed to merge contact");
      return;
    }

    const pick = (newVal: unknown, oldVal: unknown) => {
      if (newVal != null && String(newVal).trim() !== "") return String(newVal).trim();
      if (oldVal == null) return "";
      return String(oldVal);
    };

    const pickNullable = (newVal: unknown, oldVal: unknown) => {
      if (newVal != null && String(newVal).trim() !== "") return String(newVal).trim();
      if (oldVal != null && String(oldVal).trim() !== "") return String(oldVal).trim();
      return null;
    };

    const ex = existingContact;
    const nw = newContact;

    let imageUrl: string | null = ex.image ?? null;
    if (imageFile) {
      try {
        const filePath = `contacts/${sessionUser.id}/${Date.now()}-merge.jpg`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, imageFile, {
          upsert: false,
        });
        if (!uploadError) {
          const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(filePath);
          if (publicData?.publicUrl) imageUrl = publicData.publicUrl;
        }
      } catch {
        // keep existing imageUrl
      }
    }

    const existingChecks = Array.isArray(ex.checks) ? ex.checks : [];
    const newChecks = Array.isArray(nw.checks) ? nw.checks : [];
    const mergedChecks = [...new Set([...existingChecks, ...newChecks])];

    const merged: Record<string, unknown> = {
      name: pick(nw.name, ex.name),
      title: pick(nw.title, ex.title),
      company: pick(nw.company, ex.company),
      email: pickNullable(nw.email, ex.email),
      phone: pickNullable(nw.phone, ex.phone),
      linkedin: pickNullable(nw.linkedin, ex.linkedin),
      lead_score: Math.max(Number(ex.lead_score) || 0, Number(nw.lead_score) || 0),
      checks: mergedChecks,
      free_note:
        typeof nw.free_note === "string" && nw.free_note.trim()
          ? nw.free_note
          : (ex.free_note ?? "") || "",
      event:
        typeof nw.event === "string" && nw.event.trim()
          ? nw.event
          : (ex.event || "Untagged") as string,
      enriched: !!(ex.enriched || nw.enriched),
      source: "scan",
      status: "captured",
    };
    if (imageUrl) merged.image = imageUrl;

    const { error } = await supabase.from("contacts").update(merged).eq("id", ex.id);
    if (error) {
      console.error("Merge error:", error);
      showToast("Failed to merge contact");
      return;
    }

    setDuplicateModal({ show: false, existingContact: null, newContact: null, imageFile: null });
    resetScan();
    showToast("Contact merged successfully");
    router.push("/contacts");
  };

  const handleDuplicateSaveAsNew = async () => {
    setDuplicateModal({ show: false, existingContact: null, newContact: null, imageFile: null });
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData.session?.user;
    if (!sessionUser?.id) {
      showToast("Failed to save contact");
      return;
    }
    const result = await persistScannedContact(sessionUser);
    if (result === "merged") {
      resetScan();
      showToast("Matched existing prospect — contact updated.");
      router.push("/contacts");
    } else if (result === "inserted") {
      resetScan();
      showToast("Contact saved");
      router.push("/contacts");
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicateModal({ show: false, existingContact: null, newContact: null, imageFile: null });
    resetScan();
  };

  if (!user) return <div className="min-h-screen bg-[#f7f7f5]" />;

  const showRightForm = scanMode === "review" && extracted;
  const bulkTotal = bulkFiles.length;
  const bulkProcessedCount = bulkFiles.filter((x) => x.status !== 'pending').length;
  const bulkAllProcessed = bulkTotal > 0 && bulkProcessedCount === bulkTotal;
  const bulkSuccessfulCount = bulkFiles.filter((x) => x.status === 'done' && x.contact).length;
  const bulkFailedCount = bulkFiles.filter((x) => x.status === 'failed').length;

  if (bulkMode) {
    const bulkSuccessfulItems = bulkFiles.filter((x) => x.status === "done" && x.contact);
    const bulkReviewTotal = bulkSuccessfulItems.length;
    const formatEventPickerDate = (d: unknown) => {
      if (d == null || d === "") return "—";
      try {
        const t = new Date(d as string).getTime();
        if (Number.isNaN(t)) return "—";
        return new Date(t).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        return "—";
      }
    };
    const completedForEta = bulkFiles.filter((x) => x.status === "done" || x.status === "failed").length;
    const bulkScanEtaLabel = (() => {
      if (!bulkProcessing || bulkTotal === 0) return "";
      if (completedForEta === 0) return "";
      const elapsed = Date.now() - scanStartTime.current;
      const avgPerPhoto = elapsed / completedForEta;
      const remaining = Math.round(((bulkTotal - completedForEta) * avgPerPhoto) / 1000);
      if (remaining <= 5) return "Almost done...";
      if (remaining >= 60) return `~${Math.ceil(remaining / 60)}m left`;
      return `~${remaining}s left`;
    })();
    const bulkScanProgressPct = bulkTotal > 0 ? (bulkProgress / bulkTotal) * 100 : 0;
    return (
      <div
        className="min-h-screen"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
        style={{
          background: "#f7f7f5",
          overflowX: "hidden",
          maxWidth: "100vw",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        {isSaving && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                style={{ animation: "spin 0.8s linear infinite" }}
              >
                <circle cx="16" cy="16" r="12" stroke="#e8e8e8" strokeWidth="2.5" />
                <path
                  d="M16 4 A12 12 0 0 1 28 16"
                  stroke="#7dde3c"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#111", marginTop: 16 }}>Saving contacts...</div>
              <div style={{ fontSize: 13, color: "#999", marginTop: 6 }}>Please wait</div>
            </div>
          </div>
        )}
        {toast && (
          <div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 text-sm px-4 py-2 rounded-lg shadow-xl"
            style={{ background: toastColors.background, color: toastColors.color }}
          >
            {toast}
          </div>
        )}
        <div style={{ maxWidth: isMobile ? "100%" : "1100px", margin: "0 auto", padding: isMobile ? "20px 24px 0" : "36px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button
              type="button"
              onClick={() => setShowBulkDiscard(true)}
              style={{
                background: "#fff",
                border: "1px solid #ebebeb",
                borderRadius: 10,
                padding: "8px 14px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              ← Back
            </button>
            <h1 style={{ fontSize: isMobile ? 22 : 26, fontWeight: 700, color: "#111", margin: 0 }}>Bulk Upload</h1>
            <span
              style={{
                fontSize: 12,
                color: "#666",
                background: "#fff",
                border: "1px solid #ebebeb",
                borderRadius: 999,
                padding: "4px 10px",
              }}
            >
              {bulkTotal} photos
            </span>
          </div>

          <div
            style={{
              position: "sticky",
              bottom: isMobile ? 80 : 24,
              background: "#fff",
              border: "1px solid #ebebeb",
              borderRadius: 16,
              padding: 16,
              marginTop: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, color: "#999" }}>
              {bulkAllProcessed
                ? `${bulkSuccessfulCount} successful • ${bulkFailedCount} failed`
                : bulkProcessing
                ? `Scanning ${bulkProgress} of ${bulkTotal}...`
                : `${bulkProcessedCount} / ${bulkTotal} scanned`}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 12 }}>
            {bulkFiles.map((item) => (
              <div key={item.id}>
                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "1" }}>
                  <img src={item.dataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: "6px 8px",
                      background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      {item.status === 'pending' && <span style={{ color: "#ffffff" }}>Pending</span>}
                      {item.status === 'scanning' && (
                        <>
                          <span className="animate-pulse" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#7dde3c" }} />
                          <span style={{ color: "#ffffff" }}>Scanning...</span>
                        </>
                      )}
                      {item.status === 'retrying' && (
                        <span style={{ color: "#ffffff" }}>Retrying later...</span>
                      )}
                      {item.status === 'done' && (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span style={{ color: "#ffffff" }}>Done</span>
                        </>
                      )}
                      {item.status === "failed" && (
                        <span style={{ color: "#e55a5a" }}>
                          Failed — could not scan
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {item.status === 'done' && item.contact && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#111" }}>{item.contact.name ?? ''}</div>
                    <div style={{ fontSize: 10, color: "#999" }}>{item.contact.company ?? ''}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

        {bulkTotal > 0 && bulkProcessing && (
          <div
            style={{
              position: "fixed",
              bottom: 32,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
              width: 380,
              background: "#ffffff",
              borderRadius: 20,
              padding: "24px 28px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.12)",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid #e8e8e8",
                    borderTop: "2px solid #7dde3c",
                    borderRadius: "50%",
                    flexShrink: 0,
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: 16, color: "#111" }}>Scanning badges...</span>
              </div>
              <button
                type="button"
                onClick={cancelScanning}
                onMouseEnter={() => setIsHoveringCancel(true)}
                onMouseLeave={() => setIsHoveringCancel(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 14,
                  color: isHoveringCancel ? "#111" : "#999",
                  padding: "4px 8px",
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
            </div>
            <div style={{ fontSize: 13, color: "#999", marginBottom: 12 }}>
              {bulkProgress} of {bulkTotal} contacts
            </div>
            <div
              style={{
                width: "100%",
                height: 6,
                background: "#f0f0f0",
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${bulkScanProgressPct}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #7dde3c, #4db832)",
                  borderRadius: 99,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#999",
                marginTop: 8,
                textAlign: "right",
              }}
            >
              {bulkScanEtaLabel}
            </div>
          </div>
        )}
        {bulkTotal > 0 &&
          !bulkProcessing &&
          (!bulkAllProcessed || (bulkAllProcessed && bulkSuccessfulCount > 0)) && (
            <div
              style={{
                position: "fixed",
                bottom: "32px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 100,
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "rgba(255,255,255,0.9)",
                backdropFilter: "blur(12px)",
                border: "1px solid #ebebeb",
                borderRadius: "999px",
                padding: "8px 8px 8px 20px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
              }}
            >
              {!bulkAllProcessed ? (
                <>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#111",
                      marginRight: 8,
                    }}
                  >
                    {bulkTotal} photos ready
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowBulkDiscard(true)}
                    onMouseEnter={() => setIsHoveringCancel(true)}
                    onMouseLeave={() => setIsHoveringCancel(false)}
                    style={{
                      cursor: "pointer",
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: isHoveringCancel ? "#f0f0f0" : "transparent",
                      color: "#111",
                      fontSize: 14,
                      fontWeight: 500,
                      transition: "background 0.15s",
                      border: "none",
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#111",
                      marginRight: 8,
                    }}
                  >
                    {bulkSuccessfulCount} scanned successfully
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const initial: Record<string, { lead_score: number; checks: string[]; free_note: string }> = {};
                      bulkSuccessfulItems.forEach((x) => {
                        initial[x.id] = { lead_score: 5, checks: [], free_note: "" };
                      });
                      setReviewData(initial);
                      setReviewIndex(0);
                      setSelectedEventId(null);
                      setShowNewEventInput(false);
                      setNewEventName("");
                      setNewEventDate("");
                      setShowEventPicker(true);
                    }}
                    disabled={isSaving}
                    style={{
                      background: "#7dde3c",
                      color: "#0a1a0a",
                      fontWeight: 700,
                      fontSize: 14,
                      borderRadius: 999,
                      padding: "10px 22px",
                      border: "none",
                      cursor: isSaving ? "not-allowed" : "pointer",
                    }}
                  >
                    Review & Score
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBulkSaveAll()}
                    disabled={isSaving}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#999",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: isSaving ? "not-allowed" : "pointer",
                      padding: "10px 14px",
                    }}
                  >
                    Save all as-is
                  </button>
                </>
              )}
            </div>
          )}

        {showEventPicker && bulkReviewTotal > 0 && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              zIndex: 1100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 20,
                padding: 28,
                width: "100%",
                maxWidth: 440,
                margin: 20,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  marginBottom: 4,
                }}
              >
                Which event are these from?
              </div>
              <div style={{ fontSize: 13, color: "#999", marginBottom: 20 }}>
                This helps organize your contacts.
              </div>
              <div
                style={{
                  maxHeight: 280,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedEventId(null)}
                  onMouseEnter={() => setEventPickerHoverKey("no-event")}
                  onMouseLeave={() => setEventPickerHoverKey(null)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 12,
                    border:
                      selectedEventId === null
                        ? "1px solid #7dde3c"
                        : "1px dashed #ebebeb",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                    background:
                      selectedEventId === null
                        ? "#f0f7eb"
                        : eventPickerHoverKey === "no-event"
                          ? "#f5f5f5"
                          : "#fff",
                    color: selectedEventId === null ? "#2d6a1f" : "#111",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    textAlign: "left",
                  }}
                >
                  <span>No specific event</span>
                </button>
                {events.map((ev: { id: string; name?: string; date?: string }) => {
                  const sel = selectedEventId === ev.id;
                  const hov = eventPickerHoverKey === ev.id;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => {
                        setSelectedEventId(ev.id);
                        setNewEventName("");
                        setShowNewEventInput(false);
                      }}
                      onMouseEnter={() => setEventPickerHoverKey(ev.id)}
                      onMouseLeave={() => setEventPickerHoverKey(null)}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 12,
                        border: sel ? "1px solid #7dde3c" : "1px solid #ebebeb",
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: 500,
                        background: sel ? "#f0f7eb" : hov ? "#f5f5f5" : "#fff",
                        color: sel ? "#2d6a1f" : "#111",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        textAlign: "left",
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>{ev.name ?? "Untitled"}</span>
                      <span style={{ fontSize: 12, color: "#999", flexShrink: 0 }}>
                        {formatEventPickerDate(ev.date)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 10 }}>
                {!showNewEventInput ? (
                  <div
                    onClick={() => {
                      setShowNewEventInput(true);
                      setSelectedEventId(null);
                    }}
                    style={{
                      border: "1.5px dashed #ccc",
                      borderRadius: 12,
                      padding: "14px 16px",
                      color: "#999",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 15,
                    }}
                  >
                    <span>+ Create new event</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Event name"
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      autoFocus
                      style={{
                        border: "1.5px solid #7dde3c",
                        borderRadius: 12,
                        padding: "14px 16px",
                        fontSize: 15,
                        outline: "none",
                        cursor: "text",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />
                    <input
                      type="date"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      style={{
                        border: "1.5px solid #e8e8e8",
                        borderRadius: 12,
                        padding: "14px 16px",
                        fontSize: 15,
                        outline: "none",
                        cursor: "text",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: 10,
                  marginTop: 20,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEventId(null);
                    setShowEventPicker(false);
                    setIsReviewing(true);
                    setReviewIndex(0);
                    setShowNewEventInput(false);
                    setNewEventName("");
                    setNewEventDate("");
                    setEnrichingIndex(null);
                    setContactEnrichments({});
                    setEnrichmentExpanded({});
                    setEnrichErrorIndex(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#999",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (user?.id && showNewEventInput && newEventName.trim()) {
                      const { data, error } = await supabase
                        .from("events")
                        .insert({ user_id: user.id, name: newEventName.trim(), date: newEventDate || new Date().toISOString(), type: "conference" })
                        .select()
                        .single();

                      if (error || !data) {
                        showToast("Failed to create event", {
                          background: "#fde8e8",
                          color: "#c53030",
                        });
                        return;
                      }

                      console.log("Created event — id:", data.id, "name:", data.name);

                      setSelectedEventId(data.id as string);
                      setSelectedEventName(
                        typeof data.name === "string" ? data.name : String(data.name ?? "")
                      );
                      setEvents((p) => [
                        {
                          id: data.id as string,
                          name: (data.name as string) ?? "",
                          date: (data as { date?: string }).date,
                          location: (data as { location?: string }).location,
                        },
                        ...p,
                      ]);
                    }
                    setShowEventPicker(false);
                    setIsReviewing(true);
                    setReviewIndex(0);
                    setShowNewEventInput(false);
                    setNewEventName("");
                    setNewEventDate("");
                    setEnrichingIndex(null);
                    setContactEnrichments({});
                    setEnrichmentExpanded({});
                    setEnrichErrorIndex(null);
                  }}
                  style={{
                    background: "#7dde3c",
                    color: "#0a1a0a",
                    fontWeight: 700,
                    fontSize: 14,
                    borderRadius: 999,
                    padding: "12px 24px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {isReviewing && bulkReviewTotal > 0 && (() => {
          const currentItem = bulkSuccessfulItems[reviewIndex];
          const currentId = currentItem?.id;
          const rd = currentId
            ? reviewData[currentId] ?? { lead_score: 5, checks: [], free_note: "" }
            : { lead_score: 5, checks: [], free_note: "" };
          const ls = rd.lead_score;
          const scoreNumColor = ls >= 7 ? "#2d6a1f" : ls >= 4 ? "#b07020" : "#e55a5a";
          const isLastReview = reviewIndex >= bulkReviewTotal - 1;
          const c = currentItem?.contact;
          const currentEnrichment = contactEnrichments[reviewIndex];
          const hasCurrentEnrichment =
            currentEnrichment != null &&
            typeof currentEnrichment === "object" &&
            !Array.isArray(currentEnrichment);
          const isEnriched = !!(
            contactEnrichments &&
            contactEnrichments[reviewIndex] &&
            ((contactEnrichments[reviewIndex] as Record<string, unknown>).icp_fit_score ||
              (contactEnrichments[reviewIndex] as Record<string, unknown>).summary)
          );
          const isExpanded = enrichmentExpanded[reviewIndex] === true;

          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                zIndex: 1100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: 20,
                  padding: 28,
                  width: "100%",
                  maxWidth: 480,
                  maxHeight: "90vh",
                  overflowY: "auto",
                  margin: 20,
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 20,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "#999",
                    }}
                  >
                    Contact {reviewIndex + 1} of {bulkReviewTotal}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (reviewIndex >= bulkReviewTotal - 1) {
                        void handleBulkSaveAll();
                      } else {
                        setReviewIndex((i) => i + 1);
                      }
                    }}
                    style={{
                      fontSize: 13,
                      color: "#999",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Skip
                  </button>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      color: "#111",
                    }}
                  >
                    {c?.name ?? "—"}
                  </div>
                  <div style={{ fontSize: 14, color: "#999", marginBottom: 20 }}>
                    {[c?.title, c?.company].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <button
                    type="button"
                    onClick={() => void handleBulkReviewEnrich(reviewIndex, c, currentId)}
                    disabled={enrichingIndex === reviewIndex}
                    style={{
                      background: "#f0f7eb",
                      border: "1px solid #c8e6b0",
                      color: "#2d6a1f",
                      borderRadius: 10,
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: enrichingIndex === reviewIndex ? "wait" : "pointer",
                      width: "fit-content",
                      opacity: enrichingIndex === reviewIndex ? 0.75 : 1,
                    }}
                  >
                    {enrichingIndex === reviewIndex ? "Enriching..." : "✦ Enrich with AI"}
                  </button>
                  {enrichErrorIndex === reviewIndex ? (
                    <p style={{ fontSize: 12, color: "#e55a5a", marginTop: 8, marginBottom: 0 }}>
                      Enrichment failed, try again
                    </p>
                  ) : null}
                  {hasCurrentEnrichment ? (
                    (() => {
                      const en = currentEnrichment as Record<string, unknown>;
                      const fitRaw = en.icp_fit_score;
                      const fit =
                        typeof fitRaw === "number"
                          ? fitRaw
                          : typeof fitRaw === "string"
                            ? Number(fitRaw)
                            : null;
                      const fitNum = fit != null && !Number.isNaN(Number(fit)) ? Number(fit) : null;
                      const fitColor =
                        fitNum == null
                          ? "#2d6a1f"
                          : fitNum >= 7
                            ? "#2d6a1f"
                            : fitNum >= 4
                              ? "#b07020"
                              : "#e55a5a";
                      const reason = typeof en.icp_fit_reason === "string" ? en.icp_fit_reason : null;
                      const suggestedRaw = en.suggested_lead_score;
                      const suggested =
                        typeof suggestedRaw === "number"
                          ? suggestedRaw
                          : typeof suggestedRaw === "string"
                            ? Number(suggestedRaw)
                            : null;
                      const suggestedScore =
                        suggested != null && Number.isFinite(suggested)
                          ? Math.min(10, Math.max(1, Math.round(suggested)))
                          : null;
                      const summary = typeof en.summary === "string" ? en.summary : null;
                      const shortSummary =
                        summary && summary.includes(". ")
                          ? `${summary.split(". ")[0]}.`
                          : summary;
                      const ptsRaw = en.talking_points;
                      const points = (
                        Array.isArray(ptsRaw)
                          ? (ptsRaw as unknown[]).filter((x) => typeof x === "string")
                          : []
                      ).slice(0, 3);
                      const redRaw = en.red_flags;
                      const redFlags = Array.isArray(redRaw)
                        ? (redRaw as unknown[]).filter((x) => typeof x === "string")
                        : [];

                      return (
                        <div
                          style={{
                            background: "#f8fdf4",
                            border: "1px solid #d4edbc",
                            borderRadius: 12,
                            padding: "12px 14px",
                            marginTop: 12,
                          }}
                        >
                          {fitNum != null || reason ? (
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline" }}>
                              {fitNum != null ? (
                                <span style={{ fontSize: 13, fontWeight: 600, color: fitColor }}>
                                  ICP fit: {fitNum}/10
                                </span>
                              ) : null}
                              {reason ? (
                                <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>{reason}</span>
                              ) : null}
                            </div>
                          ) : null}
                          {suggestedScore != null ? (
                            <p style={{ fontSize: 12, color: "#666", marginTop: 4, marginBottom: 0 }}>
                              Suggested score: {suggestedScore}/10
                            </p>
                          ) : null}

                          {!isExpanded ? (
                            summary ? (
                              <p
                                style={{
                                  fontSize: 13,
                                  color: "#444",
                                  marginTop: 8,
                                  lineHeight: 1.5,
                                  marginBottom: 0,
                                }}
                              >
                                {shortSummary}{" "}
                                <span
                                  role="button"
                                  onClick={() =>
                                    setEnrichmentExpanded((prev) => ({ ...prev, [reviewIndex]: true }))
                                  }
                                  style={{
                                    color: "#7dde3c",
                                    fontSize: 12,
                                    cursor: "pointer",
                                    fontWeight: 500,
                                  }}
                                >
                                  ... See more
                                </span>
                              </p>
                            ) : null
                          ) : (
                            <>
                              {summary ? (
                                <p
                                  style={{
                                    fontSize: 13,
                                    color: "#444",
                                    marginTop: 8,
                                    lineHeight: 1.5,
                                    marginBottom: 0,
                                  }}
                                >
                                  {summary}
                                </p>
                              ) : null}
                              {points.length > 0 ? (
                                <div>
                                  <p
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: "#999",
                                      marginTop: 10,
                                      marginBottom: 4,
                                    }}
                                  >
                                    Talking points
                                  </p>
                                  {points.map((t, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "flex-start" }}>
                                      <span
                                        style={{
                                          width: 5,
                                          height: 5,
                                          borderRadius: 99,
                                          background: "#7dde3c",
                                          marginRight: 8,
                                          marginTop: 5,
                                          flexShrink: 0,
                                        }}
                                      />
                                      <span style={{ fontSize: 12, color: "#444" }}>{t}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {redFlags.length > 0 ? (
                                <div>
                                  <p
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: "#e55a5a",
                                      marginTop: 8,
                                      marginBottom: 4,
                                    }}
                                  >
                                    Red flags
                                  </p>
                                  {redFlags.map((t, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "flex-start" }}>
                                      <span
                                        style={{
                                          width: 5,
                                          height: 5,
                                          borderRadius: 99,
                                          background: "#e55a5a",
                                          marginRight: 8,
                                          marginTop: 5,
                                          flexShrink: 0,
                                        }}
                                      />
                                      <span style={{ fontSize: 12, color: "#e55a5a" }}>{t}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              <p style={{ marginTop: 10, marginBottom: 0 }}>
                                <span
                                  role="button"
                                  onClick={() =>
                                    setEnrichmentExpanded((prev) => ({ ...prev, [reviewIndex]: false }))
                                  }
                                  style={{ color: "#999", fontSize: 12, cursor: "pointer" }}
                                >
                                  See less
                                </span>
                              </p>
                            </>
                          )}
                        </div>
                      );
                    })()
                  ) : null}
                </div>

                {!isEnriched && (
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "#999",
                        marginBottom: 8,
                      }}
                    >
                      Lead Score
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={ls}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!currentId) return;
                          setReviewData((prev) => ({
                            ...prev,
                            [currentId]: {
                              ...(prev[currentId] ?? { lead_score: 5, checks: [], free_note: "" }),
                              lead_score: v,
                            },
                          }));
                        }}
                        style={{ flex: 1, touchAction: "none" }}
                      />
                      <span style={{ fontSize: 20, fontWeight: 700, color: scoreNumColor, minWidth: 28, textAlign: "right" }}>
                        {ls}
                      </span>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "#999",
                      marginBottom: 10,
                    }}
                  >
                    Conversation Signals
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {BULK_REVIEW_DEFAULT_SIGNALS.map((label) => (
                      <label
                        key={label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          cursor: "pointer",
                          fontSize: 14,
                          color: "#111",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={rd.checks.includes(label)}
                          onChange={() => {
                            if (!currentId) return;
                            setReviewData((prev) => {
                              const cur = prev[currentId] ?? { lead_score: 5, checks: [], free_note: "" };
                              const has = cur.checks.includes(label);
                              const nextChecks = has
                                ? cur.checks.filter((x) => x !== label)
                                : [...cur.checks, label];
                              return {
                                ...prev,
                                [currentId]: { ...cur, checks: nextChecks },
                              };
                            });
                          }}
                          style={{
                            width: 16,
                            height: 16,
                            accentColor: "#7dde3c",
                            cursor: "pointer",
                          }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <textarea
                    value={rd.free_note}
                    onChange={(e) => {
                      if (!currentId) return;
                      const v = e.target.value;
                      setReviewData((prev) => ({
                        ...prev,
                        [currentId]: {
                          ...(prev[currentId] ?? { lead_score: 5, checks: [], free_note: "" }),
                          free_note: v,
                        },
                      }));
                    }}
                    placeholder="Anything else worth remembering..."
                    style={{
                      background: "#f5f5f5",
                      border: "none",
                      borderRadius: 10,
                      padding: 12,
                      fontSize: 14,
                      width: "100%",
                      minHeight: 80,
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {!isLastReview ? (
                  <button
                    type="button"
                    onClick={() => setReviewIndex((i) => i + 1)}
                    style={{
                      background: "#7dde3c",
                      color: "#0a1a0a",
                      fontWeight: 700,
                      fontSize: 14,
                      borderRadius: 999,
                      padding: 14,
                      width: "100%",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Save & Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsReviewing(false);
                      void handleBulkSaveAll();
                    }}
                    disabled={isSaving}
                    style={{
                      background: "#7dde3c",
                      color: "#0a1a0a",
                      fontWeight: 700,
                      fontSize: 14,
                      borderRadius: 999,
                      padding: 14,
                      width: "100%",
                      border: "none",
                      cursor: isSaving ? "not-allowed" : "pointer",
                      opacity: isSaving ? 0.7 : 1,
                    }}
                  >
                    Save & Finish
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        </div>
        {showBulkDiscard && (
          <div
            style={{
              background: "rgba(0,0,0,0.4)",
              position: "fixed",
              inset: 0,
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 320, width: "100%" }}>
              <p style={{ fontSize: 17, fontWeight: 600, margin: 0, marginBottom: 8 }}>Discard scans?</p>
              <p style={{ fontSize: 14, color: "#666", margin: 0, marginBottom: 18 }}>
                You have {bulkProcessedCount} scanned contacts that will be lost.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowBulkDiscard(false)}
                  style={{
                    background: "#fff",
                    border: "1px solid #ebebeb",
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkDiscard(false);
                    setBulkMode(false);
                    setBulkFiles([]);
                    setBulkProcessing(false);
                    setBulkProgress(0);
                    setIsSaving(false);
                    setIsReviewing(false);
                    setReviewIndex(0);
                    setReviewData({});
                    setShowEventPicker(false);
                    setSelectedEventId(null);
                    setShowNewEventInput(false);
                    setNewEventName("");
                    setNewEventDate("");
                    setEnrichingIndex(null);
                    setContactEnrichments({});
                    setEnrichmentExpanded({});
                    setEnrichErrorIndex(null);
                  }}
                  style={{
                    background: "#fff",
                    border: "1px solid #fde8e8",
                    color: "#e55a5a",
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      style={{
        background: "#f7f7f5",
        overflowX: "hidden",
        maxWidth: "100vw",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <style>{`
        input[type=range] {
          touch-action: none;
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 3px;
          outline: none;
          cursor: pointer;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid #7ab648;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }
        @media (max-width: 767px) {
          button { min-height: 44px; }
        }
      `}</style>
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 text-sm px-4 py-2 rounded-lg shadow-xl"
          style={{ background: toastColors.background, color: toastColors.color }}
        >
          {toast}
        </div>
      )}
      {duplicateModal.show && duplicateModal.existingContact && duplicateModal.newContact && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 480,
              margin: 20,
            }}
          >
            <h2
              style={{
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                margin: 0,
                marginBottom: 4,
              }}
            >
              Duplicate contact found
            </h2>
            <p style={{ fontSize: 14, color: "#999", margin: 0, marginBottom: 20 }}>
              A contact with this name or email already exists. What would you like to do?
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: "#f5f5f5",
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    color: "#999",
                    marginBottom: 8,
                    letterSpacing: "0.04em",
                  }}
                >
                  Existing
                </div>
                <div style={{ color: "#111" }}>
                  <div>{duplicateModal.existingContact.name || "—"}</div>
                  <div>{duplicateModal.existingContact.title || "—"}</div>
                  <div>{duplicateModal.existingContact.company || "—"}</div>
                  <div>{duplicateModal.existingContact.email || "—"}</div>
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: "#f5f5f5",
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    color: "#999",
                    marginBottom: 8,
                    letterSpacing: "0.04em",
                  }}
                >
                  New scan
                </div>
                <div style={{ color: "#111" }}>
                  <div>{duplicateModal.newContact.name || "—"}</div>
                  <div>{duplicateModal.newContact.title || "—"}</div>
                  <div>{duplicateModal.newContact.company || "—"}</div>
                  <div>{duplicateModal.newContact.email || "—"}</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={() => void handleDuplicateMerge()}
                style={{
                  background: "#7dde3c",
                  color: "#0a1a0a",
                  fontWeight: 600,
                  fontSize: 14,
                  borderRadius: 999,
                  padding: 12,
                  width: "100%",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                Merge — keep best fields
              </button>
              <button
                type="button"
                onClick={() => void handleDuplicateSaveAsNew()}
                style={{
                  background: "#fff",
                  border: "1px solid #e8e8e8",
                  color: "#111",
                  fontWeight: 600,
                  fontSize: 14,
                  borderRadius: 999,
                  padding: 12,
                  width: "100%",
                  cursor: "pointer",
                }}
              >
                Save as new contact
              </button>
              <button
                type="button"
                onClick={handleDuplicateCancel}
                style={{
                  background: "none",
                  border: "none",
                  color: "#999",
                  fontSize: 13,
                  cursor: "pointer",
                  padding: 8,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        ref={singleUploadInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        id="single-upload-input"
        onChange={handleSmartUpload}
      />
      <input
        ref={stagedAddInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        id="staged-add-input"
        onChange={handleStagedAddMore}
      />
      <div style={{ maxWidth: isMobile ? "100%" : "1100px", margin: "0 auto", padding: isMobile ? "20px 24px 0" : "24px 24px 0" }}>
        <div style={{ marginBottom: 24, fontFamily: "Inter, sans-serif" }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: "#111",
              margin: 0,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Scan a badge
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "#999",
              marginTop: 4,
              marginBottom: 0,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Drop a photo, scan with camera, or bulk upload.
          </p>
        </div>
        {restoredDraft && (
          <div
            style={{
              fontSize: 12,
              color: "#2d6a1f",
              background: "#f0f7eb",
              borderRadius: 999,
              display: isMobile ? "flex" : "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 10px",
              marginBottom: 12,
              width: isMobile ? "100%" : "auto",
            }}
          >
            Draft restored
          </div>
        )}
      </div>
      <div
        style={{
          maxWidth: isMobile ? "100%" : "1100px",
          margin: "0 auto",
          padding: isMobile ? "0 24px 36px" : "0 24px 36px",
        }}
      >
        {scanMode === "idle" ? (
          <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: "20px",
              alignItems: "stretch",
              marginTop: 0,
            }}
          >
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
                if (!dropped.length) {
                  if (singleUploadInputRef.current) singleUploadInputRef.current.value = "";
                  if (stagedAddInputRef.current) stagedAddInputRef.current.value = "";
                  return;
                }
                const room = Math.max(0, 20 - stagedFilesRef.current.length);
                if (room === 0) {
                  if (singleUploadInputRef.current) singleUploadInputRef.current.value = "";
                  if (stagedAddInputRef.current) stagedAddInputRef.current.value = "";
                  return;
                }
                const filesToRead = dropped.slice(0, room);
                Promise.all(
                  filesToRead.map(
                    (file) =>
                      new Promise<{ id: string; dataUrl: string; file: File }>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (ev) =>
                          resolve({
                            id: Math.random().toString(36).slice(2),
                            dataUrl: ev.target?.result as string,
                            file,
                          });
                        reader.readAsDataURL(file);
                      })
                  )
                ).then((newStaged) => {
                  setStagedFiles((prev) => [...prev, ...newStaged]);
                  if (singleUploadInputRef.current) singleUploadInputRef.current.value = "";
                  if (stagedAddInputRef.current) stagedAddInputRef.current.value = "";
                });
              }}
              style={{
                background: "rgba(255,255,255,0.6)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 14,
                padding: 32,
                boxSizing: "border-box",
                minHeight: 360,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Inter, sans-serif",
              }}
            >
              <div
                style={{
                  width: "100%",
                  minHeight: 296,
                  border: "2px dashed rgba(0,0,0,0.1)",
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  padding: "28px 20px",
                  textAlign: "center",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s ease, background 0.2s ease",
                  ...(isDragging
                    ? { background: "rgba(0,0,0,0.03)", borderColor: "rgba(0,0,0,0.16)" }
                    : {}),
                }}
              >
                <Upload size={28} color="#999" strokeWidth={1.5} aria-hidden />
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    textAlign: "center",
                    color: "#111",
                    margin: 0,
                  }}
                >
                  Drop a badge or card here
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: "#999",
                    textAlign: "center",
                    lineHeight: 1.5,
                    margin: 0,
                    maxWidth: 280,
                  }}
                >
                  Drag one photo to scan, or drop multiple to bulk upload
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleOpenCamera}
                    style={{
                      background: "#1a3a2a",
                      color: "#fff",
                      fontWeight: 500,
                      borderRadius: 8,
                      padding: "9px 18px",
                      fontSize: 13,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Open Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById("single-upload-input") as HTMLInputElement | null;
                      input?.click();
                    }}
                    style={{
                      background: "#fff",
                      border: "1px solid #e8e8e8",
                      color: "#111",
                      borderRadius: 8,
                      padding: "9px 18px",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Upload photo
                  </button>
                </div>
              </div>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.6)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 14,
                padding: 32,
                boxSizing: "border-box",
                minHeight: 360,
                overflow: "hidden",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {stagedFiles.length === 0 ? (
                <div
                  style={{
                    minHeight: 296,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <UserIcon size={32} color="#ddd" strokeWidth={1.5} aria-hidden />
                  <span style={{ fontSize: 13, color: "#999", textAlign: "center" }}>
                    Contact details will appear here
                  </span>
                </div>
              ) : (
                <div style={{ padding: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>
                      {stagedFiles.length} photos ready
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setStagedFiles([]);
                      }}
                      style={{
                        color: "#999",
                        fontSize: 13,
                        cursor: "pointer",
                        background: "none",
                        border: "none",
                        padding: 0,
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    {stagedFiles.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          position: "relative",
                          aspectRatio: "1",
                          borderRadius: 10,
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={s.dataUrl}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                        <button
                          type="button"
                          aria-label="Remove"
                          onClick={() => {
                            setStagedFiles((prev) => prev.filter((x) => x.id !== s.id));
                          }}
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            width: 20,
                            height: 20,
                            minWidth: 20,
                            minHeight: 20,
                            borderRadius: "50%",
                            background: "rgba(0,0,0,0.55)",
                            border: "1.5px solid rgba(255,255,255,0.25)",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {stagedFiles.length < 20 && (
                      <button
                        type="button"
                        onClick={() => {
                          document.getElementById("staged-add-input")?.click();
                        }}
                        style={{
                          border: "1.5px dashed #ddd",
                          borderRadius: 10,
                          aspectRatio: "1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#bbb",
                          fontSize: 24,
                          background: "transparent",
                          padding: 0,
                          minHeight: 0,
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          {stagedFiles.length > 0 && (
            <div
              style={{
                position: "fixed",
                bottom: "32px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 100,
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "rgba(255,255,255,0.9)",
                backdropFilter: "blur(12px)",
                border: "1px solid #ebebeb",
                borderRadius: "999px",
                padding: "8px 8px 8px 20px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#111",
                  marginRight: 8,
                }}
              >
                {stagedFiles.length} photos ready
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (stagedFiles.length === 1) {
                    const s = stagedFiles[0];
                    setUploadedImage(s.dataUrl);
                    await scanWithClaude(s.dataUrl.split(",")[1], s.file.type);
                    setStagedFiles([]);
                  } else {
                    const newBulk = stagedFiles.map((s) => ({
                      id: s.id,
                      dataUrl: s.dataUrl,
                      status: "pending" as const,
                      contact: null,
                    }));
                    setBulkFiles(newBulk);
                    setBulkMode(true);
                    setBulkProgress(0);
                    setStagedFiles([]);
                    void handleBulkProcess(newBulk);
                  }
                }}
                style={{
                  background: "#7dde3c",
                  color: "#0a1a0a",
                  fontWeight: 700,
                  fontSize: 14,
                  borderRadius: 999,
                  padding: "10px 22px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Scan {stagedFiles.length} photos
              </button>
              <button
                type="button"
                onClick={() => {
                  setStagedFiles([]);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#999",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  padding: "10px 14px",
                }}
              >
                Cancel
              </button>
            </div>
          )}
          </>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: "24px",
              alignItems: "flex-start",
              marginTop: "24px",
            }}
          >
            <div
              style={{
                flex: isMobile ? "none" : 1,
                width: "100%",
                minWidth: 0,
              }}
            >
          {scanMode === "camera" && (
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-900">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "crisp-edges" }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-32 border-2 border-white rounded-lg opacity-60 relative">
                  {[
                    ["top-0 left-0", "border-t-2 border-l-2 -translate-x-px -translate-y-px"],
                    ["top-0 right-0", "border-t-2 border-r-2 translate-x-px -translate-y-px"],
                    ["bottom-0 left-0", "border-b-2 border-l-2 -translate-x-px translate-y-px"],
                    ["bottom-0 right-0", "border-b-2 border-r-2 translate-x-px translate-y-px"],
                  ].map(([p, c], i) => (
                    <div key={i} className={`absolute ${p} w-4 h-4 border-white rounded-sm ${c}`} />
                  ))}
                </div>
              </div>
              <div className="absolute top-3 left-0 right-0 flex justify-center">
                <span className="text-white text-xs bg-black bg-opacity-50 px-3 py-1 rounded-full">Align within frame</span>
              </div>
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-6 items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
                    setScanMode("idle");
                  }}
                  className="text-white text-xs opacity-70 hover:opacity-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCapture}
                  className="w-14 h-14 rounded-full bg-white border-4 border-white border-opacity-50 hover:scale-105 transition-transform shadow-lg"
                />
                <label className="text-white text-xs opacity-70 hover:opacity-100 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
                      setScanMode("idle");
                      handleFileUpload(e);
                    }}
                  />
                  Upload
                </label>
              </div>
            </div>
          )}

          {scanMode === "extracting" && (
            <div style={{ border: "1px solid #ebebeb", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
              {uploadedImage && (
                <div className="aspect-video bg-slate-100">
                  <img src={uploadedImage} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div style={{ padding: 40, textAlign: "center" }}>
                <div
                  className="animate-spin"
                  style={{
                    width: 36,
                    height: 36,
                    margin: "0 auto 12px",
                    border: "2px solid #e8e8e8",
                    borderTopColor: "#7ab648",
                    borderRadius: "50%",
                  }}
                />
                <p style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>Claude is reading the card...</p>
                <p style={{ fontSize: 13, color: "#999", marginTop: 4 }}>Extracting contact fields</p>
              </div>
            </div>
          )}

          {scanMode === "review" && extracted && uploadedImage && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #ebebeb", aspectRatio: "16/10", background: "#f7f7f5" }}>
                <img src={uploadedImage} alt="Scanned badge full" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
            </div>

            {/* Right column — Placeholder or Contact form */}
            <div
              style={{
                flex: isMobile ? "none" : 1,
                width: isMobile ? "100%" : "auto",
                minWidth: 0,
                position: isMobile ? "static" : "sticky",
                top: "36px",
              }}
            >
          {!showRightForm ? (
            <div
              style={{
                background: "rgba(255,255,255,0.6)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 14,
                padding: 32,
                boxSizing: "border-box",
                minHeight: 280,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: "Inter, sans-serif",
              }}
            >
              <UserIcon size={32} color="#ddd" strokeWidth={1.5} aria-hidden />
              <span style={{ fontSize: 13, color: "#999", textAlign: "center" }}>
                Contact details will appear here
              </span>
            </div>
          ) : (
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #ebebeb",
                padding: isMobile ? "20px 24px" : "28px 24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {uploadedImage && (
                  <img
                    src={uploadedImage}
                    alt="Scanned badge thumbnail"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                )}
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#111",
                    margin: 0,
                  }}
                >
                  Contact details
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {Object.entries(extracted)
                  .filter(([, val]) => {
                    const v = val as string | null | undefined;
                    return v !== null && v !== undefined && String(v).trim() !== "";
                  })
                  .map(([key, val]) => (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <input
                        type="text"
                        value={(val as string) ?? ""}
                        onChange={(e) => setExtracted({ ...extracted, [key]: e.target.value })}
                        placeholder={key.replace(/_/g, " ")}
                        style={{
                          background: "#f7f7f5",
                          border: "1px solid " + "#e8e8e8",
                          borderRadius: 8,
                          height: 40,
                          padding: "0 12px",
                          fontSize: 14,
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ))}
              </div>

              <div style={{ marginTop: 16, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => void handleSinglePanelEnrich()}
                  disabled={singlePanelEnriching}
                  style={{
                    background: "#f0f7eb",
                    border: "1px solid #c8e6b0",
                    color: "#2d6a1f",
                    borderRadius: 10,
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: singlePanelEnriching ? "wait" : "pointer",
                    width: "fit-content",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    opacity: singlePanelEnriching ? 0.75 : 1,
                  }}
                >
                  {singlePanelEnriching ? (
                    <>
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          border: "2px solid #e8e8e8",
                          borderTop: "2px solid #7dde3c",
                          borderRadius: "50%",
                          animation: "spin 0.8s linear infinite",
                        }}
                      />
                      Enriching...
                    </>
                  ) : (
                    "✦ Enrich with AI"
                  )}
                </button>
                {singleEnrichError ? (
                  <p style={{ fontSize: 12, color: "#e55a5a", margin: "8px 0 0 0" }}>
                    Enrichment failed, try again
                  </p>
                ) : null}
                {singleEnrichment &&
                typeof singleEnrichment === "object" &&
                !Array.isArray(singleEnrichment) ? (
                  (() => {
                    const en = singleEnrichment as Record<string, unknown>;
                    const fitRaw = en.icp_fit_score;
                    const fit =
                      typeof fitRaw === "number"
                        ? fitRaw
                        : typeof fitRaw === "string"
                          ? Number(fitRaw)
                          : null;
                    const fitNum =
                      fit != null && !Number.isNaN(Number(fit)) ? Number(fit) : null;
                    const fitColor =
                      fitNum == null
                        ? "#2d6a1f"
                        : fitNum >= 7
                          ? "#2d6a1f"
                          : fitNum >= 4
                            ? "#b07020"
                            : "#e55a5a";
                    const reason =
                      typeof en.icp_fit_reason === "string" ? en.icp_fit_reason : null;
                    const summary = typeof en.summary === "string" ? en.summary : null;
                    const ptsRaw = en.talking_points;
                    const points = (
                      Array.isArray(ptsRaw)
                        ? (ptsRaw as unknown[]).filter((x) => typeof x === "string")
                        : []
                    ).slice(0, 3);
                    const redRaw = en.red_flags;
                    const redFlags = Array.isArray(redRaw)
                      ? (redRaw as unknown[]).filter((x) => typeof x === "string")
                      : [];
                    return (
                      <div
                        style={{
                          marginTop: 12,
                          padding: "12px 14px",
                          background: "#f8fdf4",
                          border: "1px solid #d4edbc",
                          borderRadius: 12,
                        }}
                      >
                        {fitNum != null || reason ? (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "baseline",
                            }}
                          >
                            {fitNum != null ? (
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: fitColor,
                                }}
                              >
                                ICP fit: {fitNum}/10
                              </span>
                            ) : null}
                            {reason ? (
                              <span
                                style={{
                                  fontSize: 12,
                                  color: "#888",
                                  marginLeft: fitNum != null ? 6 : 0,
                                }}
                              >
                                {reason}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {summary ? (
                          <p
                            style={{
                              fontSize: 13,
                              color: "#444",
                              marginTop: 8,
                              lineHeight: 1.5,
                              marginBottom: 0,
                            }}
                          >
                            {summary}
                          </p>
                        ) : null}
                        {points.length > 0 ? (
                          <div>
                            <p
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#999",
                                marginTop: 10,
                                marginBottom: 4,
                                marginLeft: 0,
                                marginRight: 0,
                              }}
                            >
                              Talking points
                            </p>
                            {points.map((t, i) => (
                              <div
                                key={i}
                                style={{ display: "flex", alignItems: "flex-start" }}
                              >
                                <span
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: 99,
                                    background: "#7dde3c",
                                    marginRight: 8,
                                    marginTop: 5,
                                    flexShrink: 0,
                                  }}
                                />
                                <span style={{ fontSize: 12, color: "#444" }}>{t}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {redFlags.length > 0 ? (
                          <div>
                            <p
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#e55a5a",
                                marginTop: 8,
                                marginBottom: 4,
                                marginLeft: 0,
                                marginRight: 0,
                              }}
                            >
                              Red flags
                            </p>
                            {redFlags.map((t, i) => (
                              <div
                                key={i}
                                style={{ display: "flex", alignItems: "flex-start" }}
                              >
                                <span
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: 99,
                                    background: "#e55a5a",
                                    marginRight: 8,
                                    marginTop: 5,
                                    flexShrink: 0,
                                  }}
                                />
                                <span style={{ fontSize: 12, color: "#e55a5a" }}>{t}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })()
                ) : null}
              </div>

              {(() => {
                const isEnriched = !!(
                  singleEnrichment &&
                  (singleEnrichment.icp_fit_score || singleEnrichment.summary)
                );
                if (isEnriched) return null;
                return (
                  <div style={{ marginTop: 16, marginBottom: 12 }}>
                    <p style={{ fontSize: 13, color: "#666", marginBottom: 8, fontWeight: 500 }}>Lead Score</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={leadScore}
                        style={{
                          ["--val" as string]: `${((leadScore - 1) / 9) * 100}%`,
                          flex: 1,
                          touchAction: "none",
                          height: 6,
                          borderRadius: 3,
                        }}
                        onChange={(e) => setLeadScore(Number(e.target.value))}
                        onInput={(e) => {
                          const val = ((Number(e.currentTarget.value) - 1) / 9) * 100;
                          e.currentTarget.style.setProperty("--val", `${val}%`);
                          e.currentTarget.style.background = `linear-gradient(to right, #7ab648 ${val}%, #dce8d0 ${val}%)`;
                        }}
                      />
                      <span style={{ fontSize: 14, color: "#111", width: 24, textAlign: "right" }}>{leadScore}</span>
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 500 }}>Conversation Signals</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {signalLabels.map((label) => (
                    <label
                      key={label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        fontSize: 14,
                        color: checks[label] ? "#111" : "#666",
                      }}
                      onClick={() => setChecks((prev) => ({ ...prev, [label]: !prev[label] }))}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: `1px solid ${checks[label] ? "#7ab648" : "#dce8d0"}`,
                          background: checks[label] ? "#7ab648" : "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {checks[label] && (
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: "#666", marginBottom: 8, fontWeight: 500 }}>Additional notes</p>
                <textarea
                  value={freeNote}
                  onChange={(e) => setFreeNote(e.target.value)}
                  placeholder="Anything else worth remembering..."
                  rows={3}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#f7f7f5",
                    border: "1px solid #e8e8e8",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 14,
                    resize: "vertical",
                    minHeight: 80,
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: "#666", marginBottom: 10, fontWeight: 500 }}>Tag to Event</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {events.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => setEventTag(eventTag === ev.name ? "" : ev.name)}
                      style={{
                        padding: isMobile ? "10px 16px" : "8px 14px",
                        borderRadius: 20,
                        fontSize: 13,
                        border: eventTag === ev.name ? "1px solid #1a3a2a" : "1px solid #e8e8e8",
                        background: eventTag === ev.name ? "#f0f0ec" : "#fff",
                        color: eventTag === ev.name ? "#1a2e1a" : "#666",
                        cursor: "pointer",
                      }}
                    >
                      {ev.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowReviewNewEventForm(true)}
                    style={{
                      padding: isMobile ? "10px 16px" : "8px 14px",
                      borderRadius: 20,
                      fontSize: 13,
                      border: "1px dashed #ccc",
                      background: "transparent",
                      color: "#999",
                      cursor: "pointer",
                    }}
                  >
                    + New event
                  </button>
                </div>
                {showReviewNewEventForm && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input
                      type="text"
                      value={reviewNewEventName}
                      onChange={(e) => setReviewNewEventName(e.target.value)}
                      placeholder="Event name..."
                      style={{
                        flex: 1,
                        background: "#f7f7f5",
                        border: "1px solid #e8e8e8",
                        borderRadius: 8,
                        height: 40,
                        padding: "0 12px",
                        fontSize: 14,
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveNewEvent();
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveNewEvent}
                      style={{
                        padding: "0 16px",
                        borderRadius: 10,
                        fontSize: 14,
                        border: "1px solid #1a3a2a",
                        background: "#f0f0ec",
                        color: "#1a2e1a",
                        cursor: "pointer",
                        fontWeight: 500,
                      }}
                    >
                      Add
                    </button>
                  </div>
                )}
                {eventTag && (
                  <p style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
                    Tagged: <span style={{ fontWeight: 600, color: "#111" }}>{eventTag}</span>
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleSaveContact()}
                disabled={saving || saveContactFeedback !== null}
                style={{
                  background:
                    saveContactFeedback === "success"
                      ? "#2d6a1f"
                      : saveContactFeedback === "error"
                        ? "#fff"
                        : "#7dde3c",
                  color:
                    saveContactFeedback === "success"
                      ? "#fff"
                      : saveContactFeedback === "error"
                        ? "#e55a5a"
                        : "#0a1a0a",
                  fontWeight: 700,
                  borderRadius: 10,
                  height: isMobile ? 52 : 44,
                  width: "100%",
                  fontSize: 15,
                  border: "none",
                  cursor: saving || saveContactFeedback !== null ? "default" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                {saving ? (
                  <>
                    <div
                      className="animate-spin shrink-0"
                      style={{
                        width: 18,
                        height: 18,
                        border: "2px solid rgba(10,26,10,0.25)",
                        borderTopColor: "#0a1a0a",
                        borderRadius: "50%",
                      }}
                    />
                    Saving...
                  </>
                ) : saveContactFeedback === "success" ? (
                  "✓ Saved!"
                ) : saveContactFeedback === "error" ? (
                  "Failed — try again"
                ) : (
                  "Save Contact"
                )}
              </button>
              <button
                type="button"
                onClick={resetScan}
                style={{
                  width: "100%",
                  marginTop: 12,
                  padding: isMobile ? "12px" : "10px",
                  fontSize: isMobile ? 14 : 13,
                  color: "#999",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Discard
              </button>
            </div>
          )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
