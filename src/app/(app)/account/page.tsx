"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

  const handleSaveName = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
  const isPro = (plan as string) === "Pro"
  const scansText = isPro ? "Unlimited scans" : "10 scans per month";

  return (
    <div
      style={{
        backgroundColor: "#f7f7f5",
        minHeight: "100vh",
        fontFamily: "Inter, -apple-system, sans-serif",
        color: "#111",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 36px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111", margin: 0 }}>Account</h1>
            <p style={{ fontSize: 14, color: "#999", marginTop: 4, marginBottom: 0 }}>Manage your profile and plan.</p>
          </div>
          <button
            type="button"
            onClick={() => handleSaveName()}
            disabled={savingName}
            style={{
              background: "#7dde3c",
              color: "#0a1a0a",
              fontWeight: 700,
              borderRadius: 10,
              height: 40,
              padding: "0 20px",
              fontSize: 14,
              border: "none",
              cursor: "pointer",
            }}
          >
            {savingName ? "Saving..." : "Save"}
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
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
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#111", margin: 0 }}>{greetingName}</p>
            <p style={{ fontSize: 13, color: "#999", margin: 0 }}>{email || "—"}</p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #ebebeb",
            marginBottom: 24,
            gap: 0,
          }}
        >
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
                style={{
                  padding: "10px 16px",
                  fontSize: 14,
                  cursor: "pointer",
                  border: "none",
                  background: "transparent",
                  borderBottom: isActive ? "2px solid #111" : "2px solid transparent",
                  color: isActive ? "#111" : "#999",
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

          {activeSection === "profile" && (
            <section>
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #ebebeb",
                  borderRadius: 16,
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      width={64}
                      height={64}
                      style={{
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                      alt={displayName || greetingName || "Avatar"}
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
                      fontSize: 13,
                      color: "#7ab648",
                      fontWeight: 500,
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
                        fontSize: 13,
                        color: "#666",
                        marginBottom: 6,
                        fontWeight: 500,
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
                        height: 40,
                        padding: "0 12px",
                        borderRadius: 8,
                        border: "1px solid #e8e8e8",
                        backgroundColor: "#f7f7f5",
                        color: "#111",
                        fontSize: 14,
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
                          fontSize: 13,
                          color: "#666",
                          fontWeight: 500,
                        }}
                      >
                        Email
                      </label>
                      <span
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#999",
                        }}
                      >
                        Read only
                      </span>
                    </div>
                    <div
                      style={{
                        height: 40,
                        padding: "0 12px",
                        borderRadius: 8,
                        border: "1px solid #e8e8e8",
                        backgroundColor: "#f7f7f5",
                        fontSize: 14,
                        color: "#111",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {email || "—"}
                    </div>
                  </div>

                  {nameError && (
                    <p style={{ fontSize: 12, color: "#c47c4a" }}>{nameError}</p>
                  )}
                </form>
              </div>
            </section>
          )}

          {activeSection === "plan-billing" && (
            <section>
              <div
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #ebebeb",
                  borderRadius: 16,
                  padding: 24,
                  maxWidth: 520,
                }}
              >
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: "#111",
                    marginBottom: 4,
                  }}
                >
                  {plan}
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: "#666",
                    marginBottom: 16,
                  }}
                >
                  {scansText}
                </p>

                {!isPro && (
                  <button
                    type="button"
                    onClick={() => router.push("/signup")}
                    style={{
                      background: "#7dde3c",
                      color: "#0a1a0a",
                      padding: "0 20px",
                      height: 40,
                      borderRadius: 10,
                      border: "none",
                      fontSize: 14,
                      fontWeight: 700,
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
                      color: "#111",
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
                          color: isPro ? "#111" : "#666",
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
                  backgroundColor: "#fff",
                  border: "1px solid #ebebeb",
                  borderRadius: 16,
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
                      height: 40,
                      padding: "0 20px",
                      borderRadius: 10,
                      border: "1px solid #e8e8e8",
                      backgroundColor: "#fff",
                      color: "#666",
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    Change password
                  </button>
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      color: "#666",
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
                      }}
                    >
                      Check your email for the reset link.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

        <button
          type="button"
          onClick={handleSignOut}
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
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
