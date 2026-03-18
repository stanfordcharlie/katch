"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

function firstNameFromEmail(email: string | undefined): string {
  if (!email) return "there";
  const beforeAt = email.split("@")[0]?.trim() || "";
  if (!beforeAt) return "there";
  return beforeAt.charAt(0).toUpperCase() + beforeAt.slice(1).toLowerCase();
}

function getDisplayName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const display = (meta?.display_name as string)?.trim();
  const full = (meta?.full_name as string)?.trim();
  const name = (meta?.name as string)?.trim();
  if (display) return display;
  if (full) return full;
  if (name) return name;
  return firstNameFromEmail(user.email ?? undefined);
}

export default function AppAccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [activeSection, setActiveSection] = useState<"profile" | "plan-billing" | "security">("profile");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session?.user) {
        router.replace("/landing");
        return;
      }
      const u = data.session.user as User;
      setUser(u);
      setDisplayName(
        (u.user_metadata?.display_name as string | undefined) ||
          (u.user_metadata?.full_name as string | undefined) ||
          ""
      );
      const meta = u.user_metadata as Record<string, unknown> | undefined;
      const metaAvatar = (meta?.avatar_url as string | undefined) || "";
      if (metaAvatar) setAvatarUrl(metaAvatar);
    });
    return () => { active = false; };
  }, [router]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingName(true);
    setNameError(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
      if (error) setNameError(error.message);
    } catch (err: unknown) {
      setNameError(err instanceof Error ? err.message : "Failed to update name.");
    } finally {
      setSavingName(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResetSent(false);
    await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/login` });
    setResetSent(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/landing");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be under 2MB");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

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

  if (!user) {
    return (
      <div
        style={{
          backgroundColor: "#f0f0ec",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Geist', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#1a2e1a",
        }}
      >
        <span style={{ fontSize: 14, color: "#1a2e1a" }}>Loading…</span>
      </div>
    );
  }

  const greetingName = getDisplayName(user);
  const initial = (displayName.trim() || greetingName.trim() || user.email || "?").charAt(0).toUpperCase();
  const email = user.email ?? "";
  const plan = "Free Trial";
  const isPro = plan === "Pro";
  const scansText = isPro ? "Unlimited scans" : "10 scans per month";

  return (
    <div
      style={{
        backgroundColor: "#f0f0ec",
        minHeight: "100vh",
        fontFamily: "'Geist', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#1a2e1a",
      }}
    >
      <div className="min-h-screen flex">
        {/* Left column */}
        <aside
          style={{
            width: 240,
            backgroundColor: "#1a3a2a",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            padding: "24px 20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="flex items-center justify-center"
              style={{
                width: 48,
                height: 48,
                borderRadius: "999px",
                backgroundColor: "#7ab648",
                color: "#1a3a2a",
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <p
                className="truncate"
                style={{ color: "rgba(245,245,240,0.9)", fontSize: 15, fontWeight: 500, fontFamily: "'Geist', sans-serif" }}
              >
                {greetingName}
              </p>
              {email && (
                <p
                  className="truncate"
                  style={{ fontSize: 12, color: "#7a9a7a", fontFamily: "'Geist', sans-serif" }}
                >
                  {email}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#7ab648",
                  marginTop: 20,
                  marginBottom: 8,
                  fontFamily: "'Geist', sans-serif",
                }}
              >
                Account
              </p>
              <div className="space-y-1">
                {[
                  { id: "profile", label: "Profile" },
                  { id: "plan-billing", label: "Plan & Billing" },
                  { id: "security", label: "Security" },
                ].map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveSection(item.id as typeof activeSection)}
                      className="w-full text-left transition-colors"
                      style={{
                        display: "block",
                        padding: "9px 12px",
                        borderRadius: 8,
                        fontSize: 13,
                        backgroundColor: isActive ? "rgba(122,182,72,0.18)" : "transparent",
                        color: isActive ? "#a8d878" : "rgba(245,245,240,0.55)",
                        fontWeight: isActive ? 500 : 400,
                        fontFamily: "'Geist', sans-serif",
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* Right column */}
        <main
          className="flex-1"
          style={{
            padding: "40px 48px 48px 48px",
            backgroundColor: "#f0f0ec",
          }}
        >
          <div className="mb-6">
            <h1
              className="text-2xl font-bold"
              style={{
                color: "#1a2e1a",
                letterSpacing: "-0.03em",
                fontFamily: "'Playfair Display', 'Instrument Serif', Georgia, 'Times New Roman', serif",
                fontSize: 28,
              }}
            >
              Account
            </h1>
            <p
              className="mt-1"
              style={{
                fontSize: 13,
                color: "rgba(26,35,50,0.6)",
                fontFamily: "'Geist', sans-serif",
              }}
            >
              Manage your profile and plan.
            </p>
          </div>

          {activeSection === "profile" && (
            <section>
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #dce8d0",
                  borderRadius: 14,
                  padding: 24,
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0, 1fr)",
                  gap: 24,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      width={72}
                      height={72}
                      style={{
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                      alt={displayName || greetingName || "Avatar"}
                    />
                  ) : (
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        backgroundColor: "#7ab648",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                        fontWeight: 500,
                      }}
                    >
                      {initial}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById(
                        "account-avatar-input"
                      ) as HTMLInputElement | null;
                      input?.click();
                    }}
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      color: "#7ab648",
                      fontWeight: 500,
                      fontFamily: "'Geist', sans-serif",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                    }}
                  >
                    Change photo
                  </button>
                  <input
                    id="account-avatar-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={handleAvatarUpload}
                  />
                </div>

                <form onSubmit={handleSaveName} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "rgba(26,35,50,0.7)",
                        marginBottom: 6,
                        fontFamily: "'Geist', sans-serif",
                      }}
                    >
                      Display name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="How we refer to you"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #dce8d0",
                        backgroundColor: "#f0f0ec",
                        color: "#1a2e1a",
                        fontSize: 14,
                        fontFamily: "'Geist', sans-serif",
                      }}
                    />
                  </div>

                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <label
                        style={{
                          fontSize: 12,
                          color: "rgba(26,35,50,0.7)",
                          fontFamily: "'Geist', sans-serif",
                        }}
                      >
                        Email
                      </label>
                      <span
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#7a9a7a",
                          fontFamily: "'Geist', sans-serif",
                        }}
                      >
                        Read only
                      </span>
                    </div>
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #dce8d0",
                        backgroundColor: "#ffffff",
                        fontSize: 14,
                        color: "#1a2e1a",
                        fontFamily: "'Geist', sans-serif",
                      }}
                    >
                      {email || "—"}
                    </div>
                  </div>

                  {nameError && (
                    <p style={{ fontSize: 12, color: "#c47c4a", fontFamily: "'Geist', sans-serif" }}>{nameError}</p>
                  )}

                  <div style={{ marginTop: 4 }}>
                    <button
                      type="submit"
                      disabled={savingName}
                      style={{
                        backgroundColor: "#1a3a2a",
                        color: "#a8d878",
                        padding: "8px 20px",
                        borderRadius: 100,
                        border: "none",
                        fontSize: 13,
                        fontFamily: "'Geist', sans-serif",
                        fontWeight: 500,
                        cursor: savingName ? "not-allowed" : "pointer",
                      }}
                    >
                      {savingName ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {activeSection === "plan-billing" && (
            <section>
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #dce8d0",
                  borderRadius: 14,
                  padding: 24,
                  maxWidth: 520,
                }}
              >
                <h2
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#1a2e1a",
                    marginBottom: 4,
                  }}
                >
                  {plan}
                </h2>
                <p
                  style={{
                    fontSize: 13,
                    color: "rgba(26,35,50,0.6)",
                    marginBottom: 16,
                    fontFamily: "'Geist', sans-serif",
                  }}
                >
                  {scansText}
                </p>

                {!isPro && (
                  <button
                    type="button"
                    onClick={() => router.push("/signup")}
                    style={{
                      backgroundColor: "#7ab648",
                      color: "#ffffff",
                      padding: "8px 20px",
                      borderRadius: 100,
                      border: "none",
                      fontSize: 13,
                      fontFamily: "'Geist', sans-serif",
                      fontWeight: 500,
                      cursor: "pointer",
                      marginBottom: 20,
                    }}
                  >
                    Upgrade to Pro
                  </button>
                )}

                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      marginBottom: 8,
                      color: "#1a2e1a",
                      fontFamily: "'Geist', sans-serif",
                    }}
                  >
                    Pro includes:
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {[
                      "Unlimited scans",
                      "Priority AI generation speed",
                      "Advanced lead insights and filters",
                    ].map((feature) => (
                      <li
                        key={feature}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                          color: isPro ? "#1a2e1a" : "rgba(26,35,50,0.7)",
                          fontFamily: "'Geist', sans-serif",
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            backgroundColor: isPro ? "#7ab648" : "#dce8d0",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#ffffff",
                            fontSize: 11,
                          }}
                        >
                          ✓
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

          {activeSection === "security" && (
            <section>
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #dce8d0",
                  borderRadius: 14,
                  padding: 24,
                  maxWidth: 520,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 100,
                      border: "1px solid #dce8d0",
                      backgroundColor: "transparent",
                      color: "#1a2e1a",
                      fontSize: 13,
                      fontFamily: "'Geist', sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    Send password reset email
                  </button>
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#7a9a7a",
                      fontFamily: "'Geist', sans-serif",
                    }}
                  >
                    We&apos;ll send a secure link to {email || "your email address"} to reset your password.
                  </p>
                  {resetSent && (
                    <p
                      style={{
                        marginTop: 4,
                        fontSize: 12,
                        color: "#7ab648",
                        fontFamily: "'Geist', sans-serif",
                      }}
                    >
                      Check your email for the reset link.
                    </p>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="px-4 py-2 rounded-full border text-sm transition-colors hover:text-red-500 hover:border-red-300 hover:bg-red-50"
                    style={{
                      borderColor: "#dce8d0",
                      backgroundColor: "transparent",
                      color: "#1a2e1a",
                      fontFamily: "'Geist', sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    Sign out
                  </button>
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#7a9a7a",
                      fontFamily: "'Geist', sans-serif",
                    }}
                  >
                    You&apos;ll be signed out of Katch on this browser.
                  </p>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
