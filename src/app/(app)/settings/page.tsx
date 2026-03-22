"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Signal = { id: string; name: string; enabled: boolean };
type Field = { id: string; name: string; enabled: boolean };

const DEFAULT_SIGNALS: Signal[] = [
  { id: "1", name: "Wants a demo", enabled: true },
  { id: "2", name: "Budget approved", enabled: true },
  { id: "3", name: "Active buying timeline", enabled: true },
  { id: "4", name: "They asked me to follow up", enabled: true },
];

const DEFAULT_FIELDS: Field[] = [
  { id: "1", name: "Email", enabled: true },
  { id: "2", name: "Phone", enabled: true },
  { id: "3", name: "LinkedIn", enabled: true },
  { id: "4", name: "Company", enabled: true },
  { id: "5", name: "Title", enabled: true },
  { id: "6", name: "Event", enabled: true },
  { id: "7", name: "Lead Score", enabled: true },
  { id: "8", name: "Notes", enabled: true },
];

type SectionId =
  | "conversation-signals"
  | "contact-fields"
  | "email-tone"
  | "sequence-templates"
  | "integrations"
  | "profile"
  | "notifications"
  | "billing";

const TONE_OPTIONS = ["professional", "casual", "friendly", "bold", "funny"] as const;

function titleCaseTone(tone: string) {
  if (tone === "professional") return "Professional";
  if (tone === "casual") return "Casual";
  if (tone === "friendly") return "Friendly";
  if (tone === "bold") return "Bold";
  if (tone === "funny") return "Funny";
  return tone;
}

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <div
    onClick={() => onChange(!checked)}
    style={{
      width: "51px",
      height: "31px",
      minWidth: "51px",
      borderRadius: "999px",
      background: checked ? "#7dde3c" : "#e5e5ea",
      position: "relative",
      cursor: "pointer",
      transition: "background 0.2s ease",
      flexShrink: 0,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: "2px",
        left: checked ? "22px" : "2px",
        width: "27px",
        height: "27px",
        borderRadius: "50%",
        background: "#ffffff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
        transition: "left 0.2s ease",
      }}
    />
  </div>
);

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [signals, setSignals] = useState<Signal[]>(DEFAULT_SIGNALS);
  const [fields, setFields] = useState<Field[]>(DEFAULT_FIELDS);
  const [defaultTone, setDefaultTone] = useState<string>("professional");
  const [signalInput, setSignalInput] = useState("");
  const [fieldInput, setFieldInput] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [activeSection, setActiveSection] = useState<SectionId>("conversation-signals");
  const [notifEmailSequence, setNotifEmailSequence] = useState(true);
  const [notifWeeklySummary, setNotifWeeklySummary] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hubspotConnected, setHubspotConnected] = useState(false);
  const [hubId, setHubId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"success" | "error">("success");
  const oauthParamsHandled = useRef(false);

  const showToast = useCallback((msg: string, variant: "success" | "error" = "success") => {
    setToast(msg);
    setToastVariant(variant);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "integrations") {
      setActiveSection("integrations");
    }
    const connected = searchParams.get("connected");
    const err = searchParams.get("error");
    if (connected === "hubspot") {
      if (!oauthParamsHandled.current) {
        oauthParamsHandled.current = true;
        showToast("HubSpot connected successfully!", "success");
        router.replace("/settings?tab=integrations");
        void (async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const user = session?.user;
          if (!user) return;
          const { data } = await supabase
            .from("hubspot_tokens")
            .select("hub_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (data) {
            setHubspotConnected(true);
            setHubId((data as { hub_id: string | null }).hub_id ?? null);
          }
        })();
      }
    } else if (err === "hubspot_denied") {
      if (!oauthParamsHandled.current) {
        oauthParamsHandled.current = true;
        showToast("HubSpot connection was cancelled.", "error");
        router.replace("/settings?tab=integrations");
      }
    } else if (err === "hubspot_failed") {
      if (!oauthParamsHandled.current) {
        oauthParamsHandled.current = true;
        showToast("HubSpot connection failed. Please try again.", "error");
        router.replace("/settings?tab=integrations");
      }
    } else {
      oauthParamsHandled.current = false;
    }
  }, [searchParams, router, showToast]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || !mounted) return;
      const { data } = await supabase
        .from("hubspot_tokens")
        .select("hub_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!mounted) return;
      if (data) {
        setHubspotConnected(true);
        setHubId((data as { hub_id: string | null }).hub_id ?? null);
      } else {
        setHubspotConnected(false);
        setHubId(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || !mounted) {
        setLoadingSettings(false);
        return;
      }

      const meta = (user.user_metadata || {}) as Record<string, unknown>;
      const metaDisplay = (meta.display_name as string) || (meta.full_name as string) || (meta.name as string) || "";
      const email = user.email ?? null;
      let resolvedName = metaDisplay;
      if (!resolvedName && email) {
        const beforeAt = email.split("@")[0]?.trim() || "";
        resolvedName = beforeAt ? beforeAt.charAt(0).toUpperCase() + beforeAt.slice(1).toLowerCase() : "";
      }
      setDisplayName(resolvedName);
      setDisplayNameInput(resolvedName);
      setUserEmail(email);

      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      console.log("Loaded settings:", data, error);

      if (!data) {
        await supabase.from("user_settings").insert({
          user_id: user.id,
          signals: DEFAULT_SIGNALS,
          fields: DEFAULT_FIELDS,
          default_tone: "professional",
        });
        setSignals(DEFAULT_SIGNALS);
        setFields(DEFAULT_FIELDS);
        setDefaultTone("professional");
        setLoadingSettings(false);
        return;
      }

      if (data.signals && Array.isArray(data.signals)) {
        setSignals(data.signals as Signal[]);
      }
      if (data.fields && Array.isArray(data.fields)) {
        setFields(data.fields as Field[]);
      }
      if (data.default_tone) {
        setDefaultTone(data.default_tone as string);
      }

      setLoadingSettings(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaveStatus("saving");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      alert("Not logged in");
      setSaveStatus("idle");
      return;
    }

    console.log("Saving for user:", user.id);
    console.log("Signals:", signals);
    console.log("Fields:", fields);

    const { data, error } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: user.id,
          signals,
          fields,
          default_tone: defaultTone ?? "professional",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select();

    console.log("Save result:", data);
    console.log("Save error:", error);

    if (error) {
      alert("Error saving: " + error.message);
      setSaveStatus("idle");
    } else {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  const avatarInitials = (() => {
    if (displayName) {
      const parts = displayName.trim().split(" ");
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    if (userEmail) return userEmail.charAt(0).toUpperCase();
    return "?";
  })();

  const addSignal = () => {
    const name = signalInput.trim();
    if (!name) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setSignals((prev) => [...prev, { id, name, enabled: true }]);
    setSignalInput("");
  };

  const addField = () => {
    const name = fieldInput.trim();
    if (!name) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFields((prev) => [...prev, { id, name, enabled: true }]);
    setFieldInput("");
  };

  const handleSaveProfile = async () => {
    const name = displayNameInput.trim();
    setProfileSaving(true);
    await supabase.auth.updateUser({ data: { display_name: name } });
    setDisplayName(name);
    setProfileSaving(false);
  };

  const currentPlan = "Free Trial";

  const navGroups: { title: string; items: { id: SectionId; label: string }[] }[] = [
    {
      title: "Contacts",
      items: [
        { id: "conversation-signals", label: "Conversation Signals" },
        { id: "contact-fields", label: "Contact Fields" },
      ],
    },
    {
      title: "Sequences",
      items: [
        { id: "email-tone", label: "Email Tone Defaults" },
        { id: "sequence-templates", label: "Sequence Templates" },
      ],
    },
    {
      title: "Preferences",
      items: [
        { id: "integrations", label: "Integrations" },
        { id: "profile", label: "Profile" },
        { id: "notifications", label: "Notifications" },
        { id: "billing", label: "Billing" },
      ],
    },
  ];

  const tabs: { id: SectionId; label: string }[] = [
    { id: "conversation-signals", label: "Conversation Signals" },
    { id: "contact-fields", label: "Contact Fields" },
    { id: "email-tone", label: "Email Tone" },
    { id: "sequence-templates", label: "Sequence Templates" },
    { id: "integrations", label: "Integrations" },
    { id: "profile", label: "Profile" },
    { id: "notifications", label: "Notifications" },
    { id: "billing", label: "Billing" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f7f7f5",
        overflowX: "hidden",
        maxWidth: "100vw",
        fontFamily: "Inter, -apple-system, sans-serif",
      }}
    >
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            padding: "10px 16px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            background: toastVariant === "success" ? "#f0f7eb" : "#fde8e8",
            color: toastVariant === "success" ? "#2d6a1f" : "#c53030",
            maxWidth: "min(90vw, 400px)",
            textAlign: "center",
          }}
        >
          {toast}
        </div>
      )}
      <style>{`
        .tabs-scroll::-webkit-scrollbar{display:none}
        @media (max-width: 767px) {
          input, select, textarea { min-height: 44px; font-size: 15px; width: 100%; }
        }
      `}</style>
      <div
        className="max-w-3xl mx-auto"
        style={{
          padding: isMobile ? "20px 16px 100px" : "32px 36px 48px 36px",
        }}
      >
        {/* Page header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1
              style={{
                fontSize: isMobile ? 22 : 28,
                fontWeight: 700,
                color: "#111",
                letterSpacing: "-0.5px",
                margin: 0,
              }}
            >
              Settings
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "#999",
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              Fine-tune how Katch works for you.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            style={{
              background: "#7dde3c",
              color: "#0a1a0a",
              border: "none",
              borderRadius: "10px",
              padding: isMobile ? "0 24px" : "10px 20px",
              height: isMobile ? 44 : undefined,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              position: isMobile ? "fixed" : "static",
              bottom: isMobile ? "80px" : undefined,
              right: isMobile ? "16px" : undefined,
              zIndex: isMobile ? 50 : undefined,
            }}
          >
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save"}
          </button>
        </div>

        {/* Profile row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
            padding: isMobile ? "4px 0" : undefined,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "999px",
              backgroundColor: "#1a3a2a",
              color: "#f7f7f5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {avatarInitials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#111",
                margin: 0,
              }}
            >
              {displayName || "Your account"}
            </p>
            {userEmail && (
              <p
                style={{
                  fontSize: 12,
                  color: "#999",
                  margin: 0,
                }}
              >
                {userEmail}
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            overflowX: isMobile ? "auto" : "visible",
            WebkitOverflowScrolling: "touch",
            borderBottom: "1px solid #ebebeb",
            marginBottom: 24,
            gap: 0,
            scrollbarWidth: "none",
          }}
          className="tabs-scroll"
        >
          {tabs.map((tab) => {
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                style={{
                  background: "transparent",
                  borderBottom: active ? "2px solid #7ab648" : "2px solid transparent",
                  padding: isMobile ? "10px 14px" : "8px 16px",
                  fontSize: isMobile ? 13 : 14,
                  cursor: "pointer",
                  color: active ? "#111" : "#888",
                  fontWeight: active ? 500 : 400,
                  flexShrink: 0,
                  minHeight: isMobile ? 44 : undefined,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {loadingSettings ? (
          <p className="text-xs" style={{ color: "#999" }}>
            Loading settings…
          </p>
        ) : (
          <>
            {activeSection === "conversation-signals" && (
              <section>
                <h2
                  className="text-lg font-semibold mb-3"
                  style={{
                    color: "#1a2e1a",
                    fontFamily: "'Playfair Display', serif",
                  }}
                >
                  Conversation Signals
                </h2>
                <p
                  className="mb-4"
                  style={{ fontSize: 12, color: "rgba(26,35,50,0.6)", fontFamily: "'Geist', sans-serif" }}
                >
                  Configure the signals you mark after each conversation.
                </p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    {signals.map((signal) => (
                      isMobile ? (
                        <div
                          key={signal.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "14px 0",
                            borderBottom: "1px solid #f5f5f5",
                          }}
                        >
                          <span style={{ fontSize: 14, color: "#111", flex: 1 }}>{signal.name}</span>
                          <Toggle
                            checked={signal.enabled}
                            onChange={(v) =>
                              setSignals((prev) =>
                                prev.map((s) => (s.id === signal.id ? { ...s, enabled: v } : s))
                              )
                            }
                          />
                        </div>
                      ) : (
                        <div
                          key={signal.id}
                          className="flex items-center gap-3"
                          style={{
                            backgroundColor: "#ffffff",
                            border: "1px solid #dce8d0",
                            borderRadius: 10,
                            padding: "8px 10px",
                            width: "100%",
                          }}
                        >
                          <Toggle
                            checked={signal.enabled}
                            onChange={(v) =>
                              setSignals((prev) =>
                                prev.map((s) => (s.id === signal.id ? { ...s, enabled: v } : s))
                              )
                            }
                          />
                          <input
                            type="text"
                            value={signal.name}
                            onChange={(e) => {
                              const value = e.target.value;
                              setSignals((prev) =>
                                prev.map((s) => (s.id === signal.id ? { ...s, name: value } : s))
                              );
                            }}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              setSignals((prev) =>
                                prev.map((s) => (s.id === signal.id ? { ...s, name: value } : s))
                              );
                            }}
                            className="flex-1 px-3 py-2 text-sm rounded outline-none"
                            style={{
                              border: "none",
                              backgroundColor: "transparent",
                              color: "#1a2e1a",
                              fontFamily: "'Geist', sans-serif",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setSignals((prev) => prev.filter((s) => s.id !== signal.id))}
                            className="p-1 rounded"
                            style={{ color: "#a99a8e" }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M18 6L6 18M6 6L18 18"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                        </div>
                      )
                    ))}
                  </div>
                  <div className="flex gap-2 items-center" style={{ flexDirection: isMobile ? "column" : "row" }}>
                    <input
                      type="text"
                      value={signalInput}
                      onChange={(e) => setSignalInput(e.target.value)}
                      placeholder="Add custom signal"
                      className="flex-1 px-3 py-2 text-sm rounded border outline-none"
                      style={{
                        borderColor: "#dce8d0",
                        backgroundColor: "#f0f0ec",
                        color: "#1a2e1a",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addSignal();
                      }}
                    />
                    <button
                      type="button"
                      onClick={addSignal}
                      className="px-3 py-2 text-sm font-medium rounded border"
                      style={{
                        borderColor: "#c47c4a",
                        backgroundColor: "#f0f0ec",
                        color: "#c47c4a",
                        minHeight: isMobile ? 44 : undefined,
                        width: isMobile ? "100%" : undefined,
                      }}
                    >
                      Add
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSignals(DEFAULT_SIGNALS)}
                    className="text-xs"
                    style={{ color: "#c47c4a" }}
                  >
                    Restore defaults
                  </button>
                </div>
              </section>
            )}

            {activeSection === "contact-fields" && (
              <section>
                <h2
                  className="text-lg font-semibold mb-3"
                  style={{
                    color: "#1a2e1a",
                    fontFamily: "'Playfair Display', serif",
                  }}
                >
                  Contact Fields
                </h2>
                <p
                  className="mb-4"
                  style={{ fontSize: 12, color: "rgba(26,35,50,0.6)", fontFamily: "'Geist', sans-serif" }}
                >
                  Decide which fields you track for each contact.
                </p>
                <div
                  className="rounded-2xl p-4 space-y-4"
                  style={{ border: "1px solid #dce8d0", backgroundColor: "#ffffff" }}
                >
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <div key={field.id} className="flex items-center gap-3" style={{ width: "100%", padding: isMobile ? "12px 0" : undefined, borderBottom: isMobile ? "1px solid #f0f0f0" : undefined }}>
                        <Toggle
                          checked={field.enabled}
                          onChange={(v) =>
                            setFields((prev) =>
                              prev.map((f) => (f.id === field.id ? { ...f, enabled: v } : f))
                            )
                          }
                        />
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => {
                            const value = e.target.value;
                            setFields((prev) =>
                              prev.map((f) => (f.id === field.id ? { ...f, name: value } : f))
                            );
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim();
                            setFields((prev) =>
                              prev.map((f) => (f.id === field.id ? { ...f, name: value } : f))
                            );
                          }}
                          className="flex-1 px-3 py-2 text-sm rounded border outline-none"
                          style={{
                            borderColor: "#dce8d0",
                            backgroundColor: "#f0f0ec",
                            color: "#1a2e1a",
                            fontFamily: "'Geist', sans-serif",
                            height: isMobile ? 44 : undefined,
                            fontSize: isMobile ? 15 : undefined,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setFields((prev) => prev.filter((f) => f.id !== field.id))}
                          className="p-1 rounded"
                          style={{ color: "#a99a8e", width: isMobile ? 44 : undefined, height: isMobile ? 44 : undefined }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M18 6L6 18M6 6L18 18"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center" style={{ flexDirection: isMobile ? "column" : "row" }}>
                    <input
                      type="text"
                      value={fieldInput}
                      onChange={(e) => setFieldInput(e.target.value)}
                      placeholder="Add custom field"
                      className="flex-1 px-3 py-2 text-sm rounded border outline-none"
                      style={{
                        borderColor: "#dce8d0",
                        backgroundColor: "#f0f0ec",
                        color: "#1a2e1a",
                        fontFamily: "'Geist', sans-serif",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addField();
                      }}
                    />
                    <button
                      type="button"
                      onClick={addField}
                      className="px-3 py-2 text-sm font-medium rounded border"
                      style={{
                        borderColor: "#c47c4a",
                        backgroundColor: "#f0f0ec",
                        color: "#c47c4a",
                        minHeight: isMobile ? 44 : undefined,
                        width: isMobile ? "100%" : undefined,
                      }}
                    >
                      Add
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFields(DEFAULT_FIELDS)}
                    className="text-xs"
                    style={{ color: "#c47c4a" }}
                  >
                    Restore defaults
                  </button>
                </div>
              </section>
            )}

            {activeSection === "email-tone" && (
              <section>
                <h2
                  className="text-lg font-semibold mb-3"
                  style={{
                    color: "#1a2e1a",
                    fontFamily: "'Playfair Display', serif",
                  }}
                >
                  Email Tone Defaults
                </h2>
                <p
                  className="mb-4"
                  style={{ fontSize: 12, color: "rgba(26,35,50,0.6)", fontFamily: "'Geist', sans-serif" }}
                >
                  Default email tone for new sequences.
                </p>
                <div
                  className="rounded-2xl p-4"
                  style={{ border: "1px solid #dce8d0", backgroundColor: "#ffffff" }}
                >
                  <div className="flex flex-wrap gap-2" style={{ width: "100%" }}>
                    {TONE_OPTIONS.map((tone) => {
                      const active = defaultTone === tone;
                      return (
                        <button
                          key={tone}
                          type="button"
                          onClick={() => setDefaultTone(tone)}
                          className="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors"
                          style={{
                            borderColor: active ? "#7ab648" : "#dce8d0",
                            backgroundColor: active ? "#1a3a2a" : "#f0f0ec",
                            color: active ? "#a8d878" : "#1a2e1a",
                            fontFamily: "'Geist', sans-serif",
                            width: isMobile ? "100%" : undefined,
                            padding: isMobile ? "14px" : undefined,
                            fontSize: isMobile ? 14 : undefined,
                            minHeight: isMobile ? 44 : undefined,
                            borderRadius: isMobile ? 12 : undefined,
                          }}
                        >
                          {titleCaseTone(tone)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {activeSection === "sequence-templates" && (
              <section>
                <h2
                  className="text-lg font-semibold mb-3"
                  style={{
                    color: "#1a2e1a",
                    fontFamily: "'Playfair Display', 'Instrument Serif', Georgia, 'Times New Roman', serif",
                  }}
                >
                  Sequence Templates
                </h2>
                <p className="text-xs mb-4" style={{ color: "#6b6157" }}>
                  Manage reusable templates for multi-step sequences.
                </p>
                <div
                  className="rounded-2xl p-5"
                  style={{
                    border: "1px dashed #dce8d0",
                    backgroundColor: "#f4f1eb",
                    color: "#6b6157",
                    width: "100%",
                  }}
                >
                  <p className="text-sm font-medium mb-1" style={{ fontSize: isMobile ? 14 : undefined }}>Custom templates coming soon</p>
                  <p className="text-xs">
                    You&apos;ll be able to define your own multi-touch follow-up templates and reuse them
                    across events.
                  </p>
                </div>
              </section>
            )}

            {activeSection === "integrations" && (
              <section>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    marginBottom: 4,
                    color: "#111",
                    marginTop: 0,
                  }}
                >
                  Integrations
                </h2>
                <p style={{ fontSize: 14, color: "#999", marginBottom: 24, marginTop: 0 }}>
                  Connect Katch to your other tools.
                </p>
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #ebebeb",
                    borderRadius: 14,
                    padding: "20px 24px",
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    alignItems: isMobile ? "stretch" : "center",
                    justifyContent: "space-between",
                    gap: isMobile ? 16 : 0,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "row", gap: 14, alignItems: "center", minWidth: 0 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: "#ff7a59",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      H
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>HubSpot CRM</div>
                      <div style={{ fontSize: 13, color: "#999", marginTop: 2 }}>
                        Sync contacts directly to your HubSpot account.
                      </div>
                      {hubspotConnected && hubId != null && hubId !== "" && (
                        <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{hubId}</div>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: isMobile ? "column" : "row",
                      alignItems: isMobile ? "stretch" : "center",
                      justifyContent: "flex-end",
                      gap: 10,
                      flexShrink: 0,
                    }}
                  >
                    {hubspotConnected ? (
                      <>
                        <span
                          style={{
                            background: "#f0f7eb",
                            color: "#2d6a1f",
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 999,
                            padding: "4px 12px",
                            marginRight: isMobile ? 0 : 10,
                            alignSelf: isMobile ? "center" : undefined,
                          }}
                        >
                          ● Connected
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            const {
                              data: { session },
                            } = await supabase.auth.getSession();
                            const user = session?.user;
                            if (!user) return;
                            await supabase.from("hubspot_tokens").delete().eq("user_id", user.id);
                            setHubspotConnected(false);
                            setHubId(null);
                            showToast("HubSpot disconnected.", "success");
                          }}
                          style={{
                            background: "#fff",
                            border: "1px solid #fde8e8",
                            color: "#e55a5a",
                            fontSize: 13,
                            fontWeight: 600,
                            borderRadius: 999,
                            padding: "8px 16px",
                            cursor: "pointer",
                          }}
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = "/api/hubspot/connect";
                        }}
                        style={{
                          background: "#ff7a59",
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 600,
                          borderRadius: 999,
                          padding: "8px 20px",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Connect HubSpot
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}

            {activeSection === "profile" && (
              <section>
                <h2
                  className="text-lg font-semibold mb-3"
                  style={{
                    color: "#1a2e1a",
                    fontFamily: "'Playfair Display', serif",
                  }}
                >
                  Profile
                </h2>
                <p
                  className="mb-4"
                  style={{ fontSize: 12, color: "rgba(26,35,50,0.6)", fontFamily: "'Geist', sans-serif" }}
                >
                  Update how your name appears in Katch.
                </p>
                <div
                  className="rounded-2xl p-4 space-y-4"
                  style={{ border: "1px solid #dce8d0", backgroundColor: "#ffffff" }}
                >
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#6b6157", fontSize: isMobile ? 13 : undefined }}>
                      Display name
                    </label>
                    <input
                      type="text"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded border outline-none"
                      style={{
                        borderColor: "#dce8d0",
                        backgroundColor: "#f0f0ec",
                        color: "#1a2e1a",
                        height: isMobile ? 44 : undefined,
                        fontSize: isMobile ? 15 : undefined,
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#6b6157", fontSize: isMobile ? 13 : undefined }}>
                      Email
                    </label>
                    <div
                      className="px-3 py-2 text-sm rounded border"
                      style={{
                        borderColor: "#dce8d0",
                        backgroundColor: "#f4f1eb",
                        color: "#1a2e1a",
                        minHeight: isMobile ? 44 : undefined,
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        fontSize: isMobile ? 15 : undefined,
                      }}
                    >
                      {userEmail || "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                    <button
                      type="button"
                      style={{
                        width: isMobile ? "100%" : "auto",
                        minHeight: isMobile ? 44 : undefined,
                        border: "1px dashed #dce8d0",
                        borderRadius: 12,
                        background: "#f7f7f5",
                        color: "#6b6157",
                        fontSize: 13,
                        cursor: "pointer",
                        padding: "10px 12px",
                      }}
                    >
                      Upload avatar (coming soon)
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="px-4 py-2 text-xs font-medium rounded-full border hover:bg-[#1a3a2a] hover:text-[#1a2e1a] transition-colors"
                    style={{
                      borderColor: "#1a2e1a",
                      backgroundColor: "#f0f0ec",
                      color: "#1a2e1a",
                      minHeight: isMobile ? 44 : undefined,
                      width: isMobile ? "100%" : undefined,
                    }}
                    disabled={profileSaving}
                  >
                    {profileSaving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </section>
            )}

            {activeSection === "notifications" && (
              <section>
                <h2
                  className="text-lg font-semibold mb-3"
                  style={{
                    color: "#1a2e1a",
                    fontFamily: "'Playfair Display', serif",
                  }}
                >
                  Notifications
                </h2>
                <p
                  className="mb-4"
                  style={{ fontSize: 12, color: "rgba(26,35,50,0.6)", fontFamily: "'Geist', sans-serif" }}
                >
                  Control which updates you receive. (UI only for now.)
                </p>
                <div
                  className="rounded-2xl p-4 space-y-3"
                  style={{ border: "1px solid #dce8d0", backgroundColor: "#ffffff" }}
                >
                  <label
                    className="flex items-center justify-between gap-3 text-sm"
                    style={{ width: "100%", padding: isMobile ? "12px 0" : undefined, fontSize: isMobile ? 14 : undefined }}
                    onClick={() => setNotifEmailSequence((v) => !v)}
                  >
                    <span>Email me when a sequence is sent</span>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Toggle checked={notifEmailSequence} onChange={setNotifEmailSequence} />
                    </div>
                  </label>
                  <label
                    className="flex items-center justify-between gap-3 text-sm"
                    style={{ width: "100%", padding: isMobile ? "12px 0" : undefined, fontSize: isMobile ? 14 : undefined }}
                    onClick={() => setNotifWeeklySummary((v) => !v)}
                  >
                    <span>Weekly lead summary</span>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Toggle checked={notifWeeklySummary} onChange={setNotifWeeklySummary} />
                    </div>
                  </label>
                </div>
              </section>
            )}

            {activeSection === "billing" && (
              <section>
                <h2
                  className="text-lg font-semibold mb-3"
                  style={{
                    color: "#1a2e1a",
                    fontFamily: "'Playfair Display', serif",
                  }}
                >
                  Billing
                </h2>
                <p
                  className="mb-4"
                  style={{ fontSize: 12, color: "rgba(26,35,50,0.6)", fontFamily: "'Geist', sans-serif" }}
                >
                  Manage your plan and billing details.
                </p>
                <div
                  className="rounded-2xl p-4 flex items-center justify-between"
                  style={{
                    border: "1px solid #dce8d0",
                    backgroundColor: "#ffffff",
                    width: "100%",
                    padding: isMobile ? "16px" : undefined,
                    fontSize: isMobile ? 14 : undefined,
                  }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#1a2e1a" }}>
                      Current plan
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#6b6157" }}>
                      {currentPlan}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/signup")}
                    className="px-4 py-2 text-xs font-medium rounded-full border hover:bg-[#1a3a2a] hover:text-[#1a2e1a] transition-colors"
                    style={{
                      borderColor: "#1a2e1a",
                      backgroundColor: "#f0f0ec",
                      color: "#1a2e1a",
                      minHeight: isMobile ? 44 : undefined,
                    }}
                  >
                    Upgrade
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

