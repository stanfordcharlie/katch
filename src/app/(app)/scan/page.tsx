"use client";

import { useState, useRef, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SIGNAL_LABELS } from "@/lib/katch-constants";

export default function ScanPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [signalLabels, setSignalLabels] = useState<string[]>(DEFAULT_SIGNAL_LABELS);

  const [scanMode, setScanMode] = useState("idle");
  const [extracted, setExtracted] = useState<any>(null);
  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [freeNote, setFreeNote] = useState("");
  const [leadScore, setLeadScore] = useState(1);
  const [eventTag, setEventTag] = useState("");
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<
    Array<{
      id: string;
      dataUrl: string;
      status: 'pending' | 'scanning' | 'done' | 'failed';
      contact: any | null;
    }>
  >([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [showBulkDiscard, setShowBulkDiscard] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
      .select("id, name")
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
          setScanMode("review");
          setRestoredDraft(true);
        }
      }
    } catch (e) {}
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const resetScan = () => {
    setScanMode("idle");
    setExtracted(null);
    setEnriching(false);
    setEnriched(false);
    setUploadedImage(null);
    setChecks({});
    setFreeNote("");
    setLeadScore(1);
    setEventTag("");
    setShowNewEvent(false);
    setNewEventName("");
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    try {
      localStorage.removeItem("katch_scan_draft");
    } catch (e) {}
  };

  const handleBulkSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 20);
    if (!files.length) return;
    e.target.value = "";
    Promise.all(
      files.map(
        (file) =>
          new Promise<(typeof bulkFiles)[0]>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) =>
              resolve({
                id: Math.random().toString(36).slice(2),
                dataUrl: ev.target?.result as string,
                status: 'pending',
                contact: null,
              });
            reader.readAsDataURL(file);
          })
      )
    ).then((images) => {
      setBulkFiles(images);
      setBulkMode(true);
      setBulkProgress(0);
    });
  };

  const handleBulkProcess = async () => {
    setBulkProcessing(true);
    for (let i = 0; i < bulkFiles.length; i++) {
      const item = bulkFiles[i];
      if (item.status !== 'pending') continue;
      setBulkFiles((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'scanning' } : x)));
      setBulkProgress(i + 1);
      try {
        const base64 = item.dataUrl.split(',')[1];
        const mediaType = item.dataUrl.split(';')[0].split(':')[1];
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        });
        const data = await res.json();
        setBulkFiles((prev) =>
          prev.map((x) =>
            x.id === item.id
              ? {
                  ...x,
                  status: data.contact ? 'done' : 'failed',
                  contact: data.contact || null,
                }
              : x
          )
        );
      } catch {
        setBulkFiles((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'failed' } : x)));
      }
    }
    setBulkProcessing(false);
  };

  const handleBulkSaveAll = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData.session?.user;
    if (!sessionUser?.id) return;
    const doneItems = bulkFiles.filter((x) => x.status === 'done' && x.contact);
    for (const item of doneItems) {
      let imageUrl: string | null = null;
      try {
        const arr = item.dataUrl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const filePath = `contacts/${sessionUser.id}/${Date.now()}-${item.id}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });
        if (!uploadError && uploadData?.path) {
          const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(uploadData.path);
          imageUrl = publicData?.publicUrl ?? null;
        }
      } catch {}
      await supabase.from('contacts').insert({
        user_id: sessionUser.id,
        name: item.contact.name ?? '',
        title: item.contact.title ?? '',
        company: item.contact.company ?? '',
        email: item.contact.email ?? null,
        phone: item.contact.phone ?? null,
        linkedin: item.contact.linkedin ?? null,
        lead_score: 5,
        checks: [],
        free_note: '',
        event: eventTag || 'Untagged',
        enriched: false,
        image: imageUrl,
      });
    }
    setBulkMode(false);
    setBulkFiles([]);
    setBulkProgress(0);
    showToast(`${doneItems.length} contacts saved`);
    router.push('/contacts');
  };

  const handleOpenCamera = async () => {
    setScanMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      showToast("Camera unavailable — use photo upload");
      setScanMode("idle");
    }
  };

  const scanWithClaude = async (base64: string, mediaType: string) => {
    setScanMode("extracting");
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const data = await res.json();
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
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
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

  const handleEnrich = () => {
    setEnriching(true);
    setTimeout(() => {
      setEnriching(false);
      setEnriched(true);
      showToast("Enriched via Apollo.io");
    }, 1800);
  };

  const handleSaveNewEvent = async () => {
    const n = newEventName.trim();
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
    setShowNewEvent(false);
    setNewEventName("");
  };

  const handleSaveContact = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData.session?.user;
    if (!sessionUser?.id) {
      console.error("Save contact: no session user");
      showToast("Failed to save contact");
      return;
    }

    const activeChecks = signalLabels.filter((label) => checks[label]);

    let imageUrl: string | null = null;
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
          const file = new File([u8arr], "contact-image.jpg", { type: mime });
          const filePath = `contacts/${sessionUser.id}/${Date.now()}-scan.jpg`;
          const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
            upsert: false,
          });
          if (!uploadError) {
            const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(filePath);
            if (publicData?.publicUrl) {
              imageUrl = publicData.publicUrl;
            }
          }
        }
      } catch (e) {
        imageUrl = null;
      }
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
      enriched: !!enriched,
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
        return;
      }
      if (!data) {
        console.error("Save contact: no data returned");
        showToast("Failed to save contact");
        return;
      }
      resetScan();
      showToast("Contact saved");
      router.push("/contacts");
    } catch (err) {
      console.error("Full error:", err);
      showToast("Failed to save contact");
    }
  };

  if (!user) return <div className="min-h-screen bg-[#f7f7f5]" />;

  const showRightForm = scanMode === "review" && extracted;
  const bulkTotal = bulkFiles.length;
  const bulkProcessedCount = bulkFiles.filter((x) => x.status !== 'pending').length;
  const bulkAllProcessed = bulkTotal > 0 && bulkProcessedCount === bulkTotal;
  const bulkSuccessfulCount = bulkFiles.filter((x) => x.status === 'done' && x.contact).length;
  const bulkFailedCount = bulkFiles.filter((x) => x.status === 'failed').length;

  if (bulkMode) {
    return (
      <div
        className="min-h-screen"
        style={{
          background: "#f7f7f5",
          overflowX: "hidden",
          maxWidth: "100vw",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {toast && (
          <div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 text-sm px-4 py-2 rounded-lg shadow-xl"
            style={{ background: "#1a3a2a", color: "#fff" }}
          >
            {toast}
          </div>
        )}
        <div style={{ maxWidth: isMobile ? "100%" : "1100px", margin: "0 auto", padding: isMobile ? "20px 16px 0" : "36px 36px 0" }}>
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
                    <div style={{ fontSize: 11, fontWeight: 600, color: "white", display: "flex", alignItems: "center", gap: 6 }}>
                      {item.status === 'pending' && <span>Pending</span>}
                      {item.status === 'scanning' && (
                        <>
                          <span className="animate-pulse" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#7dde3c" }} />
                          <span>Scanning...</span>
                        </>
                      )}
                      {item.status === 'done' && (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Done</span>
                        </>
                      )}
                      {item.status === 'failed' && <span style={{ color: "#ffd1d1" }}>Failed</span>}
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
            {!bulkAllProcessed ? (
              <button
                type="button"
                onClick={handleBulkProcess}
                disabled={bulkProcessing}
                style={{
                  background: "#7dde3c",
                  color: "#0a1a0a",
                  fontWeight: 700,
                  borderRadius: 10,
                  height: 44,
                  padding: "0 24px",
                  fontSize: 15,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {bulkProcessing ? `Scanning ${bulkProgress} of ${bulkTotal}...` : `Scan all ${bulkTotal} photos`}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBulkSaveAll}
                style={{
                  background: "#7dde3c",
                  color: "#0a1a0a",
                  fontWeight: 700,
                  borderRadius: 10,
                  height: 44,
                  padding: "0 24px",
                  fontSize: 15,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Save {bulkSuccessfulCount} contacts
              </button>
            )}
          </div>
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
          style={{ background: "#1a3a2a", color: "#fff" }}
        >
          {toast}
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        id="bulk-upload-input"
        onChange={handleBulkSelect}
      />
      <div style={{ maxWidth: isMobile ? "100%" : "1100px", margin: "0 auto", padding: isMobile ? "20px 16px 0" : "36px 36px 0" }}>
        <h1
          style={{
            fontSize: isMobile ? 22 : 26,
            fontWeight: 700,
            color: "#111",
            fontFamily: "Inter, sans-serif",
            marginBottom: 4,
          }}
        >
          Scan a badge
        </h1>
        <p style={{ fontSize: 14, color: "#999", marginBottom: "24px" }}>
          Badge, business card, or photo
        </p>
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
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: "24px",
          alignItems: "flex-start",
          padding: isMobile ? "20px 16px 0" : "36px",
          maxWidth: isMobile ? "100%" : "1100px",
          margin: "0 auto",
        }}
      >
        {/* Left column — Scan area */}
        <div style={{ flex: isMobile ? "none" : 1, width: isMobile ? "100%" : "auto", minWidth: 0 }}>
          {scanMode === "idle" && (
            <>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #ebebeb",
                  borderRadius: 16,
                  padding: isMobile ? "24px 16px" : "40px 24px",
                  width: "100%",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "#f0f7eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#2d6a1f" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#111", marginBottom: 4 }}>Open Camera</p>
                <p style={{ fontSize: 13, color: "#999", marginBottom: 16 }}>Point at a badge or business card</p>
                <button
                  type="button"
                  onClick={handleOpenCamera}
                  style={{
                    background: "#7dde3c",
                    color: "#0a1a0a",
                    fontWeight: 700,
                    borderRadius: 10,
                    padding: "12px 28px",
                    fontSize: 15,
                    border: "none",
                    cursor: "pointer",
                    width: isMobile ? "100%" : "auto",
                  }}
                >
                  Open Camera
                </button>
              </div>
              <label
                style={{
                  display: "block",
                  textAlign: "center",
                  marginTop: 12,
                  color: "#7ab648",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileUpload} />
                Or upload a photo
              </label>
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById("bulk-upload-input") as HTMLInputElement | null;
                  input?.click();
                }}
                style={{
                  display: "block",
                  textAlign: "center",
                  marginTop: 8,
                  color: "#7ab648",
                  fontSize: 13,
                  cursor: "pointer",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  width: "100%",
                }}
              >
                Bulk upload
              </button>
            </>
          )}

          {scanMode === "camera" && (
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-900">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
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
              {!enriched ? (
                <button
                  type="button"
                  onClick={handleEnrich}
                  disabled={enriching}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    padding: "10px 16px",
                    border: "1px solid #e8e8e8",
                    borderRadius: 10,
                    fontSize: 14,
                    color: "#555",
                    background: "#fff",
                    cursor: enriching ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {enriching ? (
                    <>
                      <div
                        className="animate-spin"
                        style={{
                          width: 16,
                          height: 16,
                          border: "2px solid #e8e8e8",
                          borderTopColor: "#7ab648",
                          borderRadius: "50%",
                        }}
                      />
                      Enriching via Apollo.io...
                    </>
                  ) : (
                    "Enrich Contact"
                  )}
                </button>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 12,
                    padding: "10px 14px",
                    background: "#f0f7eb",
                    border: "1px solid #c8e0b0",
                    borderRadius: 10,
                    fontSize: 13,
                    color: "#2d6a1f",
                  }}
                >
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Enriched · email, phone & LinkedIn verified
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column — Placeholder or Contact form */}
        <div style={{ flex: isMobile ? "none" : 1, width: isMobile ? "100%" : "auto", minWidth: 0, position: isMobile ? "static" : "sticky", top: "36px" }}>
          {!showRightForm ? (
            <div
              style={{
                background: "#fff",
                border: "1px solid #ebebeb",
                borderRadius: "16px",
                minHeight: "280px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ccc",
                fontSize: "14px",
              }}
            >
              Scan a badge to see contact details
            </div>
          ) : (
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #ebebeb",
                padding: isMobile ? "20px 16px" : 28,
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
                    onClick={() => setShowNewEvent(true)}
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
                {showNewEvent && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input
                      type="text"
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
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
                onClick={handleSaveContact}
                style={{
                  background: "#7dde3c",
                  color: "#0a1a0a",
                  fontWeight: 700,
                  borderRadius: 10,
                  height: isMobile ? 52 : 44,
                  width: "100%",
                  fontSize: 15,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Save Contact
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
    </div>
  );
}
