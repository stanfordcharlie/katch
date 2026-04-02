"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
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

function SettingRowCard({
  title,
  description,
  children,
  controlFullWidth,
}: {
  title: string;
  description: string;
  children: ReactNode;
  controlFullWidth?: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #ebebeb",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 12,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: controlFullWidth ? "column" : "row",
        justifyContent: "space-between",
        alignItems: controlFullWidth ? "stretch" : "center",
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0, flex: controlFullWidth ? undefined : "0 1 280px" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#111",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#999",
            marginTop: 4,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {description}
        </div>
      </div>
      <div
        style={{
          flex: controlFullWidth ? undefined : 1,
          minWidth: controlFullWidth ? undefined : 180,
          alignSelf: controlFullWidth ? "stretch" : "center",
          display: "flex",
          justifyContent: controlFullWidth ? "stretch" : "flex-end",
        }}
      >
        {children}
      </div>
    </div>
  );
}

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
    { id: "integrations", label: "Integrations" },
    { id: "icp-profile", label: "ICP Profile" },
  ];

  const activeNavLabel =
    tabs.find((t) => t.id === activeSection)?.label ?? "Settings";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        fontFamily: "Inter, -apple-system, sans-serif",
        backgroundColor: "#f7f7f5",
        overflow: "hidden",
        width: "100%",
        boxSizing: "border-box",
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
        .settings-form-control {
          font-family: Inter, -apple-system, sans-serif;
          font-size: 14px;
          color: #111;
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          padding: 10px 14px;
          background: #fff;
          outline: none;
          width: 100%;
          box-sizing: border-box;
        }
        .settings-form-control:focus {
          border-color: #1a3a2a;
        }
        @media (max-width: 767px) {
          input.settings-form-control {
            min-height: 44px;
          }
        }
      `}</style>

      <aside
        style={{
          width: isMobile ? "100%" : 220,
          flexShrink: 0,
          paddingTop: 24,
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 16,
          borderRight: isMobile ? "none" : "1px solid #ebebeb",
          borderBottom: isMobile ? "1px solid #ebebeb" : "none",
          position: isMobile ? "relative" : "sticky",
          top: 0,
          alignSelf: isMobile ? "stretch" : "flex-start",
          minHeight: isMobile ? undefined : "100vh",
          maxHeight: isMobile ? "none" : "100vh",
          overflowY: isMobile ? "visible" : "auto",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          boxSizing: "border-box",
        }}
      >
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {tabs.map((tab) => {
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                style={{
                  fontSize: 13,
                  color: active ? "#1a3a2a" : "#666",
                  padding: "10px 16px",
                  borderRadius: 8,
                  cursor: "pointer",
                  border: "none",
                  background: active ? "#f0f7eb" : "transparent",
                  fontWeight: active ? 500 : 400,
                  textAlign: "left",
                  fontFamily: "Inter, sans-serif",
                  outline: "none",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div
          style={{
            marginTop: "auto",
            paddingTop: 20,
            borderTop: "1px solid #ebebeb",
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "999px",
              backgroundColor: "#1a3a2a",
              color: "#f7f7f5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {avatarInitials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#111",
                margin: 0,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {displayName || "Your account"}
            </p>
            {userEmail ? (
              <p
                style={{
                  fontSize: 11,
                  color: "#999",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {userEmail}
              </p>
            ) : null}
          </div>
        </div>
      </aside>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? "20px 16px 100px" : "32px 40px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "#999",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Settings {" > "}
              {activeNavLabel}
            </span>
            <button
              type="button"
              onClick={handleSave}
              style={{
                background: "#1a3a2a",
                color: "#fff",
                fontSize: 13,
                fontWeight: 500,
                padding: "8px 20px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {saveStatus === "saving" ? "Saving..." : "Save"}
            </button>
          </div>

          {loadingSettings ? (
          <p className="text-xs" style={{ color: "#999" }}>
            Loading settings…
          </p>
        ) : (
          <>
            {activeSection === "conversation-signals" && (
              <section>
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #ebebeb",
                    borderRadius: 12,
                    padding: "20px 24px",
                    marginBottom: 12,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#111",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Conversation Signals
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#999",
                        marginTop: 4,
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Configure the signals you mark after each conversation.
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {signals.map((signal) => (
                      <div
                        key={signal.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px 16px",
                          background: signal.enabled ? "#f0faf0" : "#fff",
                          border: signal.enabled ? "1px solid #e0f5e0" : "1px solid #e8e8e8",
                          borderRadius: 8,
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
                          className="settings-form-control"
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
                            width: "auto",
                            fontWeight: 400,
                            fontSize: 14,
                            color: "#111",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setSignals((prev) => prev.filter((s) => s.id !== signal.id))}
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: 4,
                            cursor: "pointer",
                            color: "#999",
                            fontSize: 16,
                            lineHeight: 1,
                            flexShrink: 0,
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
                      className="settings-form-control"
                      value={signalInput}
                      onChange={(e) => setSignalInput(e.target.value)}
                      placeholder="Add custom signal"
                      style={{
                        flex: isMobile ? undefined : 1,
                        width: isMobile ? "100%" : undefined,
                        minWidth: 0,
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
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #ebebeb",
                    borderRadius: 12,
                    padding: "20px 24px",
                    marginBottom: 12,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#111",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Contact Fields
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#999",
                        marginTop: 4,
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Decide which fields you track for each contact.
                    </div>
                  </div>
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
                          className="settings-form-control"
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
                            width: "auto",
                            fontWeight: 400,
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
                      className="settings-form-control"
                      value={fieldInput}
                      onChange={(e) => setFieldInput(e.target.value)}
                      placeholder="Add custom field"
                      style={{
                        flex: isMobile ? undefined : 1,
                        width: isMobile ? "100%" : undefined,
                        minWidth: 0,
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
                <SettingRowCard
                  title="Email Tone Defaults"
                  description="Default email tone for new sequences."
                  controlFullWidth
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      justifyContent: "flex-start",
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
                          fontFamily: "Inter, sans-serif",
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
                </SettingRowCard>
              </section>
            )}

            {activeSection === "integrations" && (
              <section>
                <SettingRowCard
                  title="HubSpot CRM"
                  description="Sync contacts directly to your HubSpot account."
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 10,
                      flexShrink: 0,
                    }}
                  >
                    {hubspotConnected && hubId != null && hubId !== "" && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#bbb",
                          textAlign: "right",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {hubId}
                      </div>
                    )}
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
                </SettingRowCard>
              </section>
            )}

            {activeSection === "icp-profile" && (
              <section>
                <SettingRowCard
                  title="What does your company sell?"
                  description="Helps Katch understand your product or service positioning."
                  controlFullWidth
                >
                  <textarea
                    value={icpProfile.what_we_sell}
                    onChange={(e) =>
                      setIcpProfile((p) => ({ ...p, what_we_sell: e.target.value }))
                    }
                    placeholder="e.g. AI-powered sales automation software for B2B SaaS companies"
                    rows={3}
                    className="settings-form-control resize-y"
                  />
                </SettingRowCard>
                <SettingRowCard
                  title="Who is your target customer?"
                  description="Describe your ideal buyer or account profile."
                  controlFullWidth
                >
                  <textarea
                    value={icpProfile.target_customer}
                    onChange={(e) =>
                      setIcpProfile((p) => ({ ...p, target_customer: e.target.value }))
                    }
                    placeholder="e.g. VP of Sales and CROs at Series A-C SaaS companies with 50-500 employees"
                    rows={3}
                    className="settings-form-control resize-y"
                  />
                </SettingRowCard>
                <SettingRowCard
                  title="What problems do you solve?"
                  description="Pain points your solution addresses for prospects."
                  controlFullWidth
                >
                  <textarea
                    value={icpProfile.problems_solved}
                    onChange={(e) =>
                      setIcpProfile((p) => ({ ...p, problems_solved: e.target.value }))
                    }
                    placeholder="e.g. Sales reps waste time on manual data entry and miss follow-ups after events"
                    rows={3}
                    className="settings-form-control resize-y"
                  />
                </SettingRowCard>
                <SettingRowCard
                  title="Ideal job titles"
                  description="Roles you typically sell to."
                  controlFullWidth
                >
                  <input
                    type="text"
                    className="settings-form-control"
                    value={icpProfile.ideal_titles}
                    onChange={(e) =>
                      setIcpProfile((p) => ({ ...p, ideal_titles: e.target.value }))
                    }
                    placeholder="e.g. VP Sales, CRO, Head of Revenue, Sales Director"
                  />
                </SettingRowCard>
                <SettingRowCard
                  title="Ideal industries"
                  description="Sectors or verticals you focus on."
                  controlFullWidth
                >
                  <input
                    type="text"
                    className="settings-form-control"
                    value={icpProfile.ideal_industries}
                    onChange={(e) =>
                      setIcpProfile((p) => ({ ...p, ideal_industries: e.target.value }))
                    }
                    placeholder="e.g. SaaS, Fintech, MarTech, Enterprise Software"
                  />
                </SettingRowCard>
                <SettingRowCard
                  title="Ideal company size"
                  description="Employee range, funding stage, or similar signals."
                  controlFullWidth
                >
                  <input
                    type="text"
                    className="settings-form-control"
                    value={icpProfile.ideal_company_size}
                    onChange={(e) =>
                      setIcpProfile((p) => ({ ...p, ideal_company_size: e.target.value }))
                    }
                    placeholder="e.g. 50-500 employees, Series A to Series C"
                  />
                </SettingRowCard>
                <SettingRowCard
                  title="Deal disqualifiers"
                  description="Who is not a good fit for your product or outreach."
                  controlFullWidth
                >
                  <textarea
                    value={icpProfile.disqualifiers}
                    onChange={(e) =>
                      setIcpProfile((p) => ({ ...p, disqualifiers: e.target.value }))
                    }
                    placeholder="e.g. Freelancers, companies under 10 employees, non-tech industries"
                    rows={3}
                    className="settings-form-control resize-y"
                  />
                </SettingRowCard>
                <SettingRowCard
                  title="Key value propositions"
                  description="One value prop per line — used in scoring and sequences."
                  controlFullWidth
                >
                  <textarea
                    value={icpProfile.value_props}
                    onChange={(e) =>
                      setIcpProfile((p) => ({ ...p, value_props: e.target.value }))
                    }
                    placeholder={
                      "e.g. Save 3 hours per event on manual data entry\nSync leads to HubSpot instantly\nAI-scored leads so you follow up with the right people first"
                    }
                    rows={4}
                    className="settings-form-control resize-y"
                  />
                </SettingRowCard>
              </section>
            )}

          </>
        )}
        </div>
      </div>
    </div>
  );
}

