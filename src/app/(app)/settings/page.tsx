"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
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
  | "icp-profile";

type IcpProfileForm = {
  what_we_sell: string;
  target_customer: string;
  problems_solved: string;
  ideal_titles: string;
  ideal_industries: string;
  ideal_company_size: string;
  disqualifiers: string;
  value_props: string;
};

const EMPTY_ICP_PROFILE: IcpProfileForm = {
  what_we_sell: "",
  target_customer: "",
  problems_solved: "",
  ideal_titles: "",
  ideal_industries: "",
  ideal_company_size: "",
  disqualifiers: "",
  value_props: "",
};

function parseIcpProfile(raw: unknown): IcpProfileForm {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...EMPTY_ICP_PROFILE };
  }
  const o = raw as Record<string, unknown>;
  const str = (k: keyof IcpProfileForm) =>
    o[k] == null ? "" : String(o[k]);
  return {
    what_we_sell: str("what_we_sell"),
    target_customer: str("target_customer"),
    problems_solved: str("problems_solved"),
    ideal_titles: str("ideal_titles"),
    ideal_industries: str("ideal_industries"),
    ideal_company_size: str("ideal_company_size"),
    disqualifiers: str("disqualifiers"),
    value_props: str("value_props"),
  };
}

const TONE_OPTIONS = ["professional", "casual", "friendly", "bold", "funny"] as const;

const TONE_DESCRIPTORS: Record<(typeof TONE_OPTIONS)[number], string> = {
  professional: "Formal and polished",
  casual: "Relaxed and natural",
  friendly: "Warm and approachable",
  bold: "Direct and confident",
  funny: "Light and witty",
};

function titleCaseTone(tone: string) {
  if (tone === "professional") return "Professional";
  if (tone === "casual") return "Casual";
  if (tone === "friendly") return "Friendly";
  if (tone === "bold") return "Bold";
  if (tone === "funny") return "Funny";
  return tone;
}

const SettingsCheckbox = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div
    role="checkbox"
    aria-checked={checked}
    tabIndex={0}
    onClick={() => onChange(!checked)}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onChange(!checked);
      }
    }}
    style={{
      width: 18,
      height: 18,
      borderRadius: 4,
      border: checked ? "1.5px solid #1a3a2a" : "1.5px solid #d0d0d0",
      background: checked ? "#1a3a2a" : "#ffffff",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      transition: "all 0.15s ease",
      boxSizing: "border-box",
    }}
  >
    {checked ? (
      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden>
        <path
          d="M1 4L3.5 6.5L9 1"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : null}
  </div>
);

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [signals, setSignals] = useState<Signal[]>(DEFAULT_SIGNALS);
  const [fields, setFields] = useState<Field[]>(DEFAULT_FIELDS);
  const [defaultTone, setDefaultTone] = useState<string>("professional");
  const [signalInput, setSignalInput] = useState("");
  const [fieldInput, setFieldInput] = useState("");
  const [signalInputFocused, setSignalInputFocused] = useState(false);
  const [fieldInputFocused, setFieldInputFocused] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [activeSection, setActiveSection] = useState<SectionId>("conversation-signals");
  const [isMobile, setIsMobile] = useState(false);
  const [hubspotConnected, setHubspotConnected] = useState(false);
  const [hubId, setHubId] = useState<string | null>(null);
  const [icpProfile, setIcpProfile] = useState<IcpProfileForm>(EMPTY_ICP_PROFILE);
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
    } else if (tab === "icp-profile") {
      setActiveSection("icp-profile");
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
        setUser(null);
        setLoadingSettings(false);
        return;
      }

      setUser(user);

      const meta = (user.user_metadata || {}) as Record<string, unknown>;
      const metaDisplay = (meta.display_name as string) || (meta.full_name as string) || (meta.name as string) || "";
      const email = user.email ?? null;
      let resolvedName = metaDisplay;
      if (!resolvedName && email) {
        const beforeAt = email.split("@")[0]?.trim() || "";
        resolvedName = beforeAt ? beforeAt.charAt(0).toUpperCase() + beforeAt.slice(1).toLowerCase() : "";
      }
      setDisplayName(resolvedName);
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
          icp_profile: {},
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
      if (data.icp_profile != null) {
        setIcpProfile(parseIcpProfile(data.icp_profile));
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

    const icp_profile = {
      what_we_sell: icpProfile.what_we_sell,
      target_customer: icpProfile.target_customer,
      problems_solved: icpProfile.problems_solved,
      ideal_titles: icpProfile.ideal_titles,
      ideal_industries: icpProfile.ideal_industries,
      ideal_company_size: icpProfile.ideal_company_size,
      disqualifiers: icpProfile.disqualifiers,
      value_props: icpProfile.value_props,
    };

    const { data, error } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: user.id,
          signals,
          fields,
          default_tone: defaultTone ?? "professional",
          icp_profile,
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
      if (activeSection === "icp-profile") {
        showToast("ICP Profile saved!", "success");
      }
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

  const tabs: { id: SectionId; label: string }[] = [
    { id: "conversation-signals", label: "Conversation Signals" },
    { id: "contact-fields", label: "Contact Fields" },
    { id: "email-tone", label: "Email Tone" },
    { id: "sequence-templates", label: "Sequence Templates" },
    { id: "integrations", label: "Integrations" },
    { id: "icp-profile", label: "ICP Profile" },
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
          padding: isMobile ? "20px 16px 100px" : "32px 36px 80px 36px",
        }}
      >
        {/* Page header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
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
                  border: "none",
                  borderBottom: active ? "2px solid #1a3a2a" : "2px solid transparent",
                  padding: isMobile ? "10px 14px" : "8px 16px",
                  fontSize: isMobile ? 13 : 14,
                  cursor: "pointer",
                  color: active ? "#111" : "#888",
                  fontWeight: active ? 500 : 400,
                  flexShrink: 0,
                  minHeight: isMobile ? 44 : undefined,
                  outline: "none",
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
                <div>
                  <div>
                    {signals.map((signal) => (
                      <div
                        key={signal.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "14px 16px",
                          background: signal.enabled ? "#f8fdf4" : "#ffffff",
                          border: signal.enabled ? "1px solid #d4edbc" : "1px solid #ebebeb",
                          borderRadius: 10,
                          marginBottom: 8,
                        }}
                      >
                        <SettingsCheckbox
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
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            fontSize: 14,
                            color: "#111",
                            fontWeight: 400,
                            fontFamily: "'Geist', sans-serif",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setSignals((prev) => prev.filter((s) => s.id !== signal.id))}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 4,
                            cursor: "pointer",
                            color: "#bbb",
                            fontSize: 16,
                            lineHeight: 1,
                            flexShrink: 0,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#e55a5a";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "#bbb";
                          }}
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexDirection: isMobile ? "column" : "row",
                      gap: 8,
                    }}
                  >
                    <input
                      type="text"
                      value={signalInput}
                      onChange={(e) => setSignalInput(e.target.value)}
                      placeholder="Add custom signal"
                      onFocus={() => setSignalInputFocused(true)}
                      onBlur={() => setSignalInputFocused(false)}
                      style={{
                        flex: isMobile ? undefined : 1,
                        width: isMobile ? "100%" : undefined,
                        minWidth: 0,
                        background: "#fff",
                        border: signalInputFocused ? "1px solid #1a3a2a" : "1px solid #ebebeb",
                        borderRadius: 10,
                        padding: "12px 16px",
                        fontSize: 14,
                        color: "#111",
                        outline: "none",
                        boxSizing: "border-box",
                        minHeight: isMobile ? 44 : undefined,
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addSignal();
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexShrink: 0,
                        width: isMobile ? "100%" : "auto",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSignals(DEFAULT_SIGNALS)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#999";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "#bbb";
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#bbb",
                          fontSize: 13,
                          fontWeight: 400,
                          cursor: "pointer",
                          padding: "0 8px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Restore defaults
                      </button>
                      <button
                        type="button"
                        onClick={addSignal}
                        style={{
                          background: "#1a3a2a",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "10px 18px",
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: "pointer",
                          minHeight: isMobile ? 44 : undefined,
                          flex: isMobile ? 1 : undefined,
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
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
                <div>
                  <div>
                    {fields.map((field) => (
                      <div
                        key={field.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "14px 16px",
                          background: field.enabled ? "#f8fdf4" : "#ffffff",
                          border: field.enabled ? "1px solid #d4edbc" : "1px solid #ebebeb",
                          borderRadius: 10,
                          marginBottom: 8,
                        }}
                      >
                        <SettingsCheckbox
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
                          style={{
                            flex: 1,
                            minWidth: 0,
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            fontSize: 14,
                            color: "#111",
                            fontWeight: 400,
                            fontFamily: "'Geist', sans-serif",
                            minHeight: isMobile ? 44 : undefined,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setFields((prev) => prev.filter((f) => f.id !== field.id))}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 4,
                            cursor: "pointer",
                            color: "#bbb",
                            fontSize: 16,
                            lineHeight: 1,
                            flexShrink: 0,
                            width: isMobile ? 44 : undefined,
                            height: isMobile ? 44 : undefined,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "#e55a5a";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "#bbb";
                          }}
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexDirection: isMobile ? "column" : "row",
                      gap: 8,
                    }}
                  >
                    <input
                      type="text"
                      value={fieldInput}
                      onChange={(e) => setFieldInput(e.target.value)}
                      placeholder="Add custom field"
                      onFocus={() => setFieldInputFocused(true)}
                      onBlur={() => setFieldInputFocused(false)}
                      style={{
                        flex: isMobile ? undefined : 1,
                        width: isMobile ? "100%" : undefined,
                        minWidth: 0,
                        background: "#fff",
                        border: fieldInputFocused ? "1px solid #1a3a2a" : "1px solid #ebebeb",
                        borderRadius: 10,
                        padding: "12px 16px",
                        fontSize: 14,
                        color: "#111",
                        outline: "none",
                        boxSizing: "border-box",
                        fontFamily: "'Geist', sans-serif",
                        minHeight: isMobile ? 44 : undefined,
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addField();
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexShrink: 0,
                        width: isMobile ? "100%" : "auto",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setFields(DEFAULT_FIELDS)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#999";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "#bbb";
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#bbb",
                          fontSize: 13,
                          fontWeight: 400,
                          cursor: "pointer",
                          padding: "0 8px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Restore defaults
                      </button>
                      <button
                        type="button"
                        onClick={addField}
                        style={{
                          background: "#1a3a2a",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "10px 18px",
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: "pointer",
                          minHeight: isMobile ? 44 : undefined,
                          flex: isMobile ? 1 : undefined,
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
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
                  style={{ fontSize: 12, color: "rgba(26,35,50,0.6)", fontFamily: "'Geist', sans-serif", margin: 0 }}
                >
                  Default email tone for new sequences.
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    marginTop: 16,
                  }}
                >
                  {TONE_OPTIONS.map((tone) => {
                    const active = defaultTone === tone;
                    return (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => setDefaultTone(tone)}
                        onMouseEnter={(e) => {
                          if (defaultTone === tone) return;
                          e.currentTarget.style.border = "1px solid #ccc";
                          e.currentTarget.style.background = "#fafafa";
                        }}
                        onMouseLeave={(e) => {
                          if (defaultTone === tone) return;
                          e.currentTarget.style.border = "1px solid #ebebeb";
                          e.currentTarget.style.background = "#ffffff";
                        }}
                        style={{
                          position: "relative",
                          background: active ? "#f0f7eb" : "#ffffff",
                          border: active ? "1.5px solid #1a3a2a" : "1px solid #ebebeb",
                          borderRadius: 12,
                          padding: "16px 20px",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          minWidth: 120,
                          transition: "all 0.15s ease",
                          textAlign: "left",
                          fontFamily: "'Geist', sans-serif",
                          width: isMobile ? "100%" : undefined,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      >
                        {active ? (
                          <div
                            style={{
                              position: "absolute",
                              top: 12,
                              right: 12,
                              width: 18,
                              height: 18,
                              borderRadius: 99,
                              background: "#1a3a2a",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden>
                              <path
                                d="M1 4L3.5 6.5L9 1"
                                stroke="white"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        ) : null}
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: active ? "#1a3a2a" : "#111",
                            paddingRight: active ? 24 : 0,
                          }}
                        >
                          {titleCaseTone(tone)}
                        </span>
                        <span style={{ fontSize: 12, color: "#999" }}>{TONE_DESCRIPTORS[tone]}</span>
                      </button>
                    );
                  })}
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
                          if (!user) return;
                          window.location.href = `/api/hubspot/connect?userId=${user.id}`;
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

            {activeSection === "icp-profile" && (
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
                  ICP Profile
                </h2>
                <p style={{ fontSize: 14, color: "#999", marginBottom: 24, marginTop: 0 }}>
                  Tell Katch about your company and ideal customers to sharpen scoring and sequences.
                </p>
                <div
                  className="rounded-2xl p-4 space-y-4"
                  style={{ border: "1px solid #dce8d0", backgroundColor: "#ffffff" }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "#999",
                      marginBottom: 4,
                    }}
                  >
                    Your Company
                  </div>
                  <div>
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "#6b6157", fontSize: isMobile ? 13 : undefined }}
                    >
                      What does your company sell?
                    </label>
                    <textarea
                      value={icpProfile.what_we_sell}
                      onChange={(e) =>
                        setIcpProfile((p) => ({ ...p, what_we_sell: e.target.value }))
                      }
                      placeholder="e.g. AI-powered sales automation software for B2B SaaS companies"
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded border outline-none resize-y"
                      style={{
                        borderColor: "#dce8d0",
                        backgroundColor: "#f0f0ec",
                        color: "#1a2e1a",
                        minHeight: isMobile ? 88 : undefined,
                        fontSize: isMobile ? 15 : undefined,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "#6b6157", fontSize: isMobile ? 13 : undefined }}
                    >
                      Who is your target customer?
                    </label>
                    <textarea
                      value={icpProfile.target_customer}
                      onChange={(e) =>
                        setIcpProfile((p) => ({ ...p, target_customer: e.target.value }))
                      }
                      placeholder="e.g. VP of Sales and CROs at Series A-C SaaS companies with 50-500 employees"
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded border outline-none resize-y"
                      style={{
                        borderColor: "#dce8d0",
                        backgroundColor: "#f0f0ec",
                        color: "#1a2e1a",
                        minHeight: isMobile ? 88 : undefined,
                        fontSize: isMobile ? 15 : undefined,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "#6b6157", fontSize: isMobile ? 13 : undefined }}
                    >
                      What problems do you solve?
                    </label>
                    <textarea
                      value={icpProfile.problems_solved}
                      onChange={(e) =>
                        setIcpProfile((p) => ({ ...p, problems_solved: e.target.value }))
                      }
                      placeholder="e.g. Sales reps waste time on manual data entry and miss follow-ups after events"
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded border outline-none resize-y"
                      style={{
                        borderColor: "#dce8d0",
                        backgroundColor: "#f0f0ec",
                        color: "#1a2e1a",
                        minHeight: isMobile ? 88 : undefined,
                        fontSize: isMobile ? 15 : undefined,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "#999",
                      marginTop: 8,
                      marginBottom: 4,
                    }}
                  >
                    Ideal customer profile
                  </div>
                  <div>
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "#6b6157", fontSize: isMobile ? 13 : undefined }}
                    >
                      Ideal job titles
                    </label>
                    <input
                      type="text"
                      value={icpProfile.ideal_titles}
                      onChange={(e) =>
                        setIcpProfile((p) => ({ ...p, ideal_titles: e.target.value }))
                      }
                      placeholder="e.g. VP Sales, CRO, Head of Revenue, Sales Director"
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
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "#6b6157", fontSize: isMobile ? 13 : undefined }}
                    >
                      Ideal industries
                    </label>
                    <input
                      type="text"
                      value={icpProfile.ideal_industries}
                      onChange={(e) =>
                        setIcpProfile((p) => ({ ...p, ideal_industries: e.target.value }))
                      }
                      placeholder="e.g. SaaS, Fintech, MarTech, Enterprise Software"
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
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "#6b6157", fontSize: isMobile ? 13 : undefined }}
                    >
                      Ideal company size
                    </label>
                    <input
                      type="text"
                      value={icpProfile.ideal_company_size}
                      onChange={(e) =>
                        setIcpProfile((p) => ({ ...p, ideal_company_size: e.target.value }))
                      }
                      placeholder="e.g. 50-500 employees, Series A to Series C"
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
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "#6b6157", fontSize: isMobile ? 13 : undefined }}
                    >
                      Deal disqualifiers (who is NOT a good fit)
                    </label>
                    <textarea
                      value={icpProfile.disqualifiers}
                      onChange={(e) =>
                        setIcpProfile((p) => ({ ...p, disqualifiers: e.target.value }))
                      }
                      placeholder="e.g. Freelancers, companies under 10 employees, non-tech industries"
                      rows={3}
                      className="w-full px-3 py-2 text-sm rounded border outline-none resize-y"
                      style={{
                        borderColor: "#dce8d0",
                        backgroundColor: "#f0f0ec",
                        color: "#1a2e1a",
                        minHeight: isMobile ? 88 : undefined,
                        fontSize: isMobile ? 15 : undefined,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "#999",
                      marginTop: 8,
                      marginBottom: 4,
                    }}
                  >
                    Talking Points
                  </div>
                  <div>
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "#6b6157", fontSize: isMobile ? 13 : undefined }}
                    >
                      Key value propositions (one per line)
                    </label>
                    <textarea
                      value={icpProfile.value_props}
                      onChange={(e) =>
                        setIcpProfile((p) => ({ ...p, value_props: e.target.value }))
                      }
                      placeholder={
                        "e.g. Save 3 hours per event on manual data entry\nSync leads to HubSpot instantly\nAI-scored leads so you follow up with the right people first"
                      }
                      rows={4}
                      className="w-full px-3 py-2 text-sm rounded border outline-none resize-y"
                      style={{
                        borderColor: "#dce8d0",
                        backgroundColor: "#f0f0ec",
                        color: "#1a2e1a",
                        minHeight: isMobile ? 120 : undefined,
                        fontSize: isMobile ? 15 : undefined,
                      }}
                    />
                  </div>
                </div>
              </section>
            )}

          </>
        )}
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid #ebebeb",
          padding: "14px 32px",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          zIndex: 100,
        }}
      >
        <span
          style={{
            color: "#2d6a1f",
            fontSize: 13,
            marginRight: 16,
            opacity: saveStatus === "saved" ? 1 : 0,
            transition: "opacity 0.25s ease",
            pointerEvents: "none",
          }}
        >
          Changes saved
        </span>
        <button
          type="button"
          onClick={handleSave}
          style={{
            background: "#1a3a2a",
            color: "#ffffff",
            border: "none",
            borderRadius: 10,
            padding: "10px 28px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {saveStatus === "saving" ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

