"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AccountTab = "profile" | "notifications" | "billing";

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

function resolvedNameFromUser(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const display = (meta?.display_name as string | undefined)?.trim();
  const full = (meta?.full_name as string | undefined)?.trim();
  const name = (meta?.name as string | undefined)?.trim();
  if (display) return display;
  if (full) return full;
  if (name) return name;
  const email = user.email ?? "";
  const beforeAt = email.split("@")[0]?.trim() || "";
  return beforeAt ? beforeAt.charAt(0).toUpperCase() + beforeAt.slice(1).toLowerCase() : "";
}

function headerDisplayName(screenName: string, user: User): string {
  const s = screenName.trim();
  if (s) return s;
  return resolvedNameFromUser(user) || "Your account";
}

function avatarInitials(name: string, email: string | null): string {
  if (name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  if (email) return email.charAt(0).toUpperCase();
  return "?";
}

type UserSettingsRow = {
  screen_name?: string | null;
  company?: string | null;
  phone?: string | null;
  email_on_sequence_sent?: boolean | null;
  weekly_lead_summary?: boolean | null;
};

export default function AppAccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AccountTab>("profile");
  const [isMobile, setIsMobile] = useState(false);

  const [screenName, setScreenName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [notifEmailSequence, setNotifEmailSequence] = useState(true);
  const [notifWeeklySummary, setNotifWeeklySummary] = useState(false);

  const [profileSaving, setProfileSaving] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [notifError, setNotifError] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session?.user) {
        router.replace("/landing");
        return;
      }
      const u = session.user as User;
      setUser(u);
      setUserEmail(u.email ?? null);
      const meta = u.user_metadata as Record<string, unknown> | undefined;
      const metaAvatar = (meta?.avatar_url as string | undefined) || "";
      if (metaAvatar) setAvatarUrl(metaAvatar);

      const { data: settings, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", u.id)
        .single();

      if (!mounted) return;

      if (error && error.code !== "PGRST116") {
        console.error("user_settings load:", error);
      }

      const row = (settings || {}) as UserSettingsRow;

      const sn =
        (typeof row.screen_name === "string" && row.screen_name.trim()
          ? row.screen_name.trim()
          : null) ?? resolvedNameFromUser(u);
      setScreenName(sn);
      setCompany(typeof row.company === "string" ? row.company : "");
      setPhone(typeof row.phone === "string" ? row.phone : "");
      if (row.email_on_sequence_sent != null) {
        setNotifEmailSequence(!!row.email_on_sequence_sent);
      }
      if (row.weekly_lead_summary != null) {
        setNotifWeeklySummary(!!row.weekly_lead_summary);
      }

      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const { error: upErr } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          screen_name: screenName.trim(),
          company: company.trim() || null,
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (upErr) {
        setProfileError(upErr.message);
        return;
      }
      const { error: authErr } = await supabase.auth.updateUser({
        data: { display_name: screenName.trim() || undefined },
      });
      if (authErr) {
        setProfileError(authErr.message);
        return;
      }
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Failed to save profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!user) return;
    setNotifSaving(true);
    setNotifError(null);
    try {
      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          email_on_sequence_sent: notifEmailSequence,
          weekly_lead_summary: notifWeeklySummary,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) setNotifError(error.message);
    } catch (e) {
      setNotifError(e instanceof Error ? e.message : "Failed to save notifications.");
    } finally {
      setNotifSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be under 2MB");
      return;
    }

    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (!u) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `${u.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const newAvatarUrl = data.publicUrl;

    await supabase.auth.updateUser({
      data: { avatar_url: newAvatarUrl },
    });

    setAvatarUrl(newAvatarUrl);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/landing");
  };

  if (loading || !user) {
    return (
      <div
        style={{
          backgroundColor: "#f7f7f5",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, -apple-system, sans-serif",
          color: "#111",
        }}
      >
        <span style={{ fontSize: 14, color: "#999" }}>Loading…</span>
      </div>
    );
  }

  const nameForHeader = headerDisplayName(screenName, user);
  const initials = avatarInitials(nameForHeader, userEmail);
  const email = user.email ?? "";

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f7f7f5",
        overflowX: "hidden",
        maxWidth: "100vw",
        fontFamily: "Inter, -apple-system, sans-serif",
        color: "#111",
      }}
    >
      <style>{`
        .account-tabs-scroll::-webkit-scrollbar{display:none}
        @media (max-width: 767px) {
          .account-page input, .account-page textarea { min-height: 44px; font-size: 15px; width: 100%; }
        }
      `}</style>
      <div
        className="account-page max-w-3xl mx-auto"
        style={{
          padding: isMobile ? "20px 16px 100px" : "32px 36px 48px 36px",
        }}
      >
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
              Account Settings
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "#999",
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              Manage your profile, notifications and billing.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
            padding: isMobile ? "4px 0" : undefined,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width={40}
              height={40}
              style={{ borderRadius: "999px", objectFit: "cover", display: "block", flexShrink: 0 }}
            />
          ) : (
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
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#111", margin: 0 }}>{nameForHeader}</p>
            {userEmail ? (
              <p style={{ fontSize: 12, color: "#999", margin: 0 }}>{userEmail}</p>
            ) : null}
          </div>
        </div>

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
          className="account-tabs-scroll"
        >
          {(
            [
              { id: "profile" as const, label: "Profile" },
              { id: "notifications" as const, label: "Notifications" },
              { id: "billing" as const, label: "Billing" },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: "transparent",
                  border: "none",
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

        {activeTab === "profile" && (
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
              Update how you appear in Katch and your contact details.
            </p>
            <div
              className="rounded-2xl p-4 space-y-4"
              style={{ border: "1px solid #dce8d0", backgroundColor: "#ffffff" }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    width={64}
                    height={64}
                    style={{ borderRadius: "50%", objectFit: "cover" }}
                    alt=""
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      backgroundColor: "#1a3a2a",
                      color: "#f7f7f5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      fontWeight: 600,
                    }}
                  >
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById("account-avatar-input") as HTMLInputElement | null;
                    input?.click();
                  }}
                  style={{
                    fontSize: 13,
                    color: "#7ab648",
                    fontWeight: 500,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Upload avatar
                </button>
                <input
                  id="account-avatar-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={handleAvatarUpload}
                />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: "#6b6157", fontSize: isMobile ? 13 : undefined }}>
                  Screen name
                </label>
                <input
                  type="text"
                  value={screenName}
                  onChange={(e) => setScreenName(e.target.value)}
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
                  Company
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
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
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                  {email || "—"}
                </div>
              </div>

              {profileError ? (
                <p className="text-xs" style={{ color: "#c53030" }}>
                  {profileError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                className="px-4 py-2 text-xs font-medium rounded-full border transition-colors"
                style={{
                  borderColor: "#1a2e1a",
                  backgroundColor: "#7dde3c",
                  color: "#0a1a0a",
                  minHeight: isMobile ? 44 : undefined,
                  width: isMobile ? "100%" : undefined,
                  fontWeight: 600,
                  cursor: profileSaving ? "not-allowed" : "pointer",
                  opacity: profileSaving ? 0.7 : 1,
                }}
                disabled={profileSaving}
              >
                {profileSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </section>
        )}

        {activeTab === "notifications" && (
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
              Choose which updates you want to receive.
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

            {notifError ? (
              <p className="text-xs mt-3" style={{ color: "#c53030" }}>
                {notifError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSaveNotifications()}
              className="mt-4 px-4 py-2 text-xs font-medium rounded-full border transition-colors"
              style={{
                borderColor: "#1a2e1a",
                backgroundColor: "#7dde3c",
                color: "#0a1a0a",
                minHeight: isMobile ? 44 : undefined,
                width: isMobile ? "100%" : undefined,
                fontWeight: 600,
                cursor: notifSaving ? "not-allowed" : "pointer",
                opacity: notifSaving ? 0.7 : 1,
              }}
              disabled={notifSaving}
            >
              {notifSaving ? "Saving..." : "Save"}
            </button>
          </section>
        )}

        {activeTab === "billing" && (
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
              Your subscription and usage.
            </p>
            <div
              className="rounded-2xl p-4 space-y-4"
              style={{ border: "1px solid #dce8d0", backgroundColor: "#ffffff" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#111", margin: 0 }}>Free Plan</p>
                  <p style={{ fontSize: 12, color: "#6b6157", marginTop: 4, marginBottom: 0 }}>
                    Core scanning and lead capture for individuals.
                  </p>
                </div>
                <span
                  style={{
                    background: "#f0f7eb",
                    color: "#2d6a1f",
                    fontSize: "11px",
                    fontWeight: 700,
                    borderRadius: "999px",
                    padding: "2px 10px",
                    letterSpacing: "0.02em",
                    flexShrink: 0,
                  }}
                >
                  FREE
                </span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {[
                  "AI badge and business card scanning",
                  "Contact management and lead scores",
                  "Email sequences and HubSpot sync",
                ].map((feature) => (
                  <li
                    key={feature}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      color: "#1a2e1a",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        backgroundColor: "#7ab648",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => router.push("/signup")}
                style={{
                  background: "#7dde3c",
                  color: "#0a1a0a",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  width: isMobile ? "100%" : "auto",
                  minHeight: isMobile ? 44 : undefined,
                }}
              >
                Upgrade to Pro →
              </button>
              <p style={{ fontSize: 12, color: "#999", margin: 0 }}>Billing management coming soon.</p>
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={() => void handleSignOut()}
          style={{
            background: "#fff",
            border: "1px solid #e8e8e8",
            color: "#666",
            borderRadius: 10,
            height: 40,
            padding: "0 20px",
            fontSize: 14,
            cursor: "pointer",
            marginTop: 24,
            width: isMobile ? "100%" : "auto",
            minHeight: isMobile ? 44 : undefined,
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
