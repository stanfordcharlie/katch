"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type PlanKey = "free" | "pro";

const PLANS: Record<
  PlanKey,
  {
    name: string;
    subtitle: string;
    price: string;
  }
> = {
  free: {
    name: "Free Trial",
    subtitle: "$0 · 10 scans / month",
    price: "$0",
  },
  pro: {
    name: "Pro",
    subtitle: "$49.99 / month per user",
    price: "$49.99",
  },
};

function ScanFrameIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8V4h4M16 4h4v4M4 16v4h4M20 16v4h-4"
        stroke="#3b6fd4"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoLockup() {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: "#f0f2f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ScanFrameIcon />
      </div>
      <span style={{ fontWeight: 700, fontSize: 18, color: "#111", marginLeft: 10 }}>Katch</span>
    </div>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <path
        d="M3.5 8L6.5 11L12.5 5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SignupNav({ onLogin, navPad }: { onLogin: () => void; navPad: string }) {
  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: 64,
        padding: navPad,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #ebebeb",
        boxSizing: "border-box",
      }}
    >
      <a href="/landing" style={{ textDecoration: "none", color: "inherit" }}>
        <LogoLockup />
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, color: "#666" }}>Already have an account?</span>
        <button
          type="button"
          onClick={onLogin}
          style={{
            fontSize: 14,
            color: "#1a3a2a",
            fontWeight: 600,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Log in
        </button>
      </div>
    </nav>
  );
}

function SignupForm({
  initialEmail,
  selectedPlan,
  onBack,
  onSuccess,
  onLogin,
}: {
  initialEmail: string;
  selectedPlan: PlanKey;
  onBack: () => void;
  onSuccess: () => void;
  onLogin: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [screenName, setScreenName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: screenName } },
      });
      if (err) {
        setError(err.message);
      } else {
        if (data.user?.id) {
          await supabase.from("user_settings").upsert({
            user_id: data.user.id,
            company: company,
            phone: phone,
            screen_name: screenName,
          });
        }
        setShowConfirmation(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #e8e8e8",
    background: "#ffffff",
    padding: "10px 12px",
    fontSize: 16,
    outline: "none",
    color: "#111",
    height: 44,
    boxSizing: "border-box",
    fontFamily: "Inter, system-ui, sans-serif",
  };

  return showConfirmation ? (
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          border: "1px solid #ebebeb",
          padding: "48px 40px",
          maxWidth: 440,
          width: "100%",
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
            margin: "0 auto 20px",
          }}
        >
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#7dde3c" strokeWidth="2.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 10 }}>Check your email</h2>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 8, lineHeight: 1.6 }}>
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account and start scanning.
        </p>
        <p style={{ fontSize: 12, color: "#bbb", marginTop: 12 }}>Did not get it? Check your spam folder.</p>
      </div>
    </div>
  ) : (
    <section
      style={{
        maxWidth: 512,
        margin: "0 auto",
        border: "1px solid #e8e8e8",
        borderRadius: 20,
        background: "#ffffff",
        padding: "24px 28px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#7dde3c", marginBottom: 8, fontWeight: 700 }}>
            SIGN UP
          </p>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0a0a0a", letterSpacing: "-0.02em", marginBottom: 4 }}>
            {PLANS[selectedPlan].name}
          </h2>
          <p style={{ fontSize: 13, color: "#666" }}>{PLANS[selectedPlan].subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onBack();
            setError(null);
          }}
          style={{
            fontSize: 12,
            textDecoration: "underline",
            color: "#666",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Back to plans
        </button>
      </div>

      <div style={{ minHeight: 40 }}>
        {error && (
          <div style={{ marginBottom: 16, borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", padding: "10px 12px", fontSize: 14, color: "#991b1b" }}>
            {error}
          </div>
        )}
      </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label htmlFor="email" style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500, color: "#111" }}>
              Work email
            </label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          </div>

          <div>
            <label htmlFor="screen-name" style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500, color: "#111" }}>
              Screen Name
            </label>
            <input
              id="screen-name"
              type="text"
              value={screenName}
              onChange={(e) => setScreenName(e.target.value)}
              required
              placeholder="Your name in the app"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="company" style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500, color: "#111" }}>
              Company Name
            </label>
            <input
              id="company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Inc."
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="phone" style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500, color: "#111" }}>
              Phone Number
            </label>
            <input
              id="phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500, color: "#111" }}>
              Password
            </label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              width: "100%",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              background: "#1a3a2a",
              color: "#fff",
              border: "none",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {loading ? "Creating your account..." : "Create account"}
          </button>
        </form>

      <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
        Already have a Katch account?{" "}
        <button
          type="button"
          onClick={onLogin}
          style={{
            color: "#1a3a2a",
            fontWeight: 600,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          Log in
        </button>
      </p>
    </section>
  );
}

function SignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email");
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/home");
      }
    });
  }, [router]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const navPad = isMobile ? "0 20px" : "0 40px";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", color: "#111", fontFamily: "Inter, system-ui, sans-serif" }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      />
      <style>{`html, body { background: #ffffff !important; }`}</style>

      <SignupNav onLogin={() => router.push("/login")} navPad={navPad} />

      <main style={{ paddingTop: 120, paddingBottom: 80 }}>
        {!selectedPlan && (
          <>
            <header
              style={{
                textAlign: "center",
                maxWidth: 600,
                margin: "0 auto",
                paddingBottom: 48,
                paddingLeft: isMobile ? 24 : 0,
                paddingRight: isMobile ? 24 : 0,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#7dde3c",
                  letterSpacing: "0.15em",
                  marginBottom: 12,
                }}
              >
                PRICING
              </div>
              <h1
                style={{
                  fontSize: isMobile ? 28 : 40,
                  fontWeight: 800,
                  color: "#0a0a0a",
                  letterSpacing: "-1px",
                  marginBottom: 12,
                  lineHeight: 1.15,
                }}
              >
                Pick your plan, start scanning.
              </h1>
              <p style={{ fontSize: 16, color: "#666", lineHeight: 1.6 }}>
                Start free or go straight to Pro. No setup, no revops ticket — just clean conference lead capture.
              </p>
            </header>

            <section
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                gap: 24,
                maxWidth: 1000,
                margin: "0 auto",
                padding: isMobile ? "0 24px 80px" : "0 40px 80px",
              }}
            >
              <div
                style={{
                  background: "#f8f9f8",
                  border: "1px solid #e8e8e8",
                  borderRadius: 20,
                  padding: "28px 24px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#666", marginBottom: 4 }}>Free Trial</div>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 20 }}>No credit card required</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 44, fontWeight: 800, color: "#111" }}>$0</span>
                  <span style={{ fontSize: 16, color: "#999" }}>/month</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
                  {["10 badge scans per month", "Basic contact extraction", "1 event", "No AI sequences"].map((t) => (
                    <li key={t} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                      <CheckIcon color="#2d6a1f" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setSelectedPlan("free")}
                  style={{
                    width: "100%",
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginTop: 24,
                    background: "#f0f0f0",
                    color: "#111",
                    border: "none",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  Start free trial
                </button>
              </div>

              <div
                style={{
                  background: "#1a3a2a",
                  border: "2px solid #7dde3c",
                  borderRadius: 20,
                  padding: "28px 24px",
                  boxShadow: "0 8px 40px rgba(26,58,42,0.2)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    background: "#7dde3c",
                    color: "#0a1a0a",
                    borderRadius: 99,
                    padding: "3px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    display: "inline-block",
                    marginBottom: 12,
                    alignSelf: "flex-start",
                  }}
                >
                  MOST POPULAR
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>Pro</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>For reps who live on the show floor</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 44, fontWeight: 800, color: "#ffffff" }}>$49.99</span>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>/month per user</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    "Unlimited badge scans",
                    "Claude Vision + Apollo enrichment",
                    "Unlimited events",
                    "AI follow-up sequences",
                    "Pipeline dashboard",
                    "CRM sync",
                  ].map((t) => (
                    <li key={t} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#ffffff" }}>
                      <CheckIcon color="#7dde3c" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setSelectedPlan("pro")}
                  style={{
                    width: "100%",
                    background: "#7dde3c",
                    color: "#0a1a0a",
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    marginTop: 24,
                    border: "none",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  Get started
                </button>
              </div>

              <div
                style={{
                  background: "#f8f9f8",
                  border: "1px solid #e8e8e8",
                  borderRadius: 20,
                  padding: "28px 24px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#666", marginBottom: 4 }}>Enterprise</div>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 20 }}>For field marketing and large sales orgs</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: "#111" }}>Custom</span>
                  <span style={{ fontSize: 16, color: "#999" }}>pricing</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    "Everything in Pro",
                    "Team management + SSO",
                    "Dedicated onboarding",
                    "Custom CRM integrations",
                    "SLA + priority support",
                  ].map((t) => (
                    <li key={t} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                      <CheckIcon color="#2d6a1f" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="mailto:hello@katch.app"
                  style={{
                    width: "100%",
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginTop: 24,
                    background: "#f0f0f0",
                    color: "#111",
                    border: "none",
                    fontFamily: "Inter, system-ui, sans-serif",
                    textAlign: "center",
                    textDecoration: "none",
                    display: "block",
                    boxSizing: "border-box",
                  }}
                >
                  Talk to sales
                </a>
              </div>
            </section>

            <p style={{ textAlign: "center", fontSize: 12, color: "#999", marginTop: 8, padding: "0 24px" }}>
              By signing up you agree to our Terms of Service and Privacy Policy.
            </p>
          </>
        )}

        {selectedPlan && (
          <div style={{ padding: isMobile ? "0 24px" : "0 40px", maxWidth: 560, margin: "0 auto" }}>
            <SignupForm
              initialEmail={emailParam ?? ""}
              selectedPlan={selectedPlan}
              onBack={() => setSelectedPlan(null)}
              onSuccess={() => router.push("/home")}
              onLogin={() => router.push("/login")}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#ffffff" }} />}>
      <SignupInner />
    </Suspense>
  );
}
