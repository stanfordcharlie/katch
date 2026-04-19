"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Mode = "signin" | "signup";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/home");
      }
    });
  }, [router]);

  useEffect(() => {
    if (mode === "signup") setStep(0);
  }, [mode]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const canAdvanceFromStep = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return emailValid;
    return true;
  };

  const performAuth = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
        } else if (data.session) {
          router.push("/home");
        } else {
          setInfo("Check your email to confirm your account, then sign in.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
        } else {
          router.push("/home");
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup") {
      if (step < 2) {
        if (canAdvanceFromStep()) setStep((s) => s + 1);
        return;
      }
      await performAuth();
    } else {
      await performAuth();
    }
  };

  const handleSignupFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (step < 2) {
      if (canAdvanceFromStep()) setStep((s) => s + 1);
    } else {
      if (password.length > 0 && !loading) {
        void performAuth();
      }
    }
  };

  const questions = ["What's your name?", "What's your email?", "Create a password."];

  if (mode === "signup") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: "24px 16px",
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .signup-input::placeholder {
            color: rgba(255,255,255,0.3);
          }
          .signup-input:focus {
            border: 1px solid rgba(255,255,255,0.4) !important;
            outline: none;
          }
        `}</style>
        <img
          src="/hero-city.jpg"
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 420,
            textAlign: "center",
            animation: "fadeIn 0.5s ease forwards",
          }}
        >
          {error && (
            <div
              className="mb-4 rounded-lg border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm"
              style={{ color: "#fecaca" }}
            >
              {error}
            </div>
          )}
          {info && (
            <div
              className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-sm"
              style={{ color: "#86efac" }}
            >
              {info}
            </div>
          )}

          <form onSubmit={handleFormSubmit}>
            <div key={step} style={{ animation: "slideUp 0.4s ease forwards" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 100,
                  padding: "6px 16px",
                  color: "#fff",
                  fontSize: 13,
                }}
              >
                <img src="/logo.svg" width={20} height={20} alt="" style={{ borderRadius: 6 }} />
                Katch
              </div>
              <p
                style={{
                  marginTop: 20,
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Step {step + 1} of 3
              </p>
              <h2
                style={{
                  marginTop: 12,
                  color: "#fff",
                  fontWeight: 300,
                  fontSize: 32,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                {questions[step]}
              </h2>

              {step === 0 && (
                <input
                  className="signup-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleSignupFieldKeyDown}
                  placeholder="Your name"
                  autoComplete="name"
                  autoFocus
                  style={{
                    width: "100%",
                    marginTop: 24,
                    background: "rgba(255,255,255,0.08)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 12,
                    padding: "16px 20px",
                    fontSize: 16,
                    color: "#fff",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              )}
              {step === 1 && (
                <input
                  className="signup-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleSignupFieldKeyDown}
                  placeholder="you@company.com"
                  autoComplete="email"
                  autoFocus
                  style={{
                    width: "100%",
                    marginTop: 24,
                    background: "rgba(255,255,255,0.08)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 12,
                    padding: "16px 20px",
                    fontSize: 16,
                    color: "#fff",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              )}
              {step === 2 && (
                <input
                  className="signup-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleSignupFieldKeyDown}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  autoFocus
                  style={{
                    width: "100%",
                    marginTop: 24,
                    background: "rgba(255,255,255,0.08)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 12,
                    padding: "16px 20px",
                    fontSize: 16,
                    color: "#fff",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              )}

              <button
                type="submit"
                disabled={loading || (step === 0 && !name.trim()) || (step === 1 && !emailValid) || (step === 2 && !password)}
                style={{
                  marginTop: 16,
                  width: "100%",
                  background: "#fff",
                  color: "#0a0a0a",
                  borderRadius: 100,
                  padding: "14px 32px",
                  fontSize: 15,
                  fontWeight: 600,
                  border: "none",
                  cursor: loading ? "wait" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading
                  ? "Creating account..."
                  : step === 2
                    ? "Create account"
                    : "Continue"}
              </button>
            </div>
          </form>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginTop: 20,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: i === step ? "#fff" : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>

          <p style={{ marginTop: 28, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
                setInfo(null);
                setStep(0);
              }}
              style={{
                color: "#fff",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                font: "inherit",
                fontWeight: 600,
              }}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#f0f0ec",
        minHeight: "100vh",
        color: "#1a2e1a",
      }}
    >
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white/90 p-8 shadow-sm">
          <Link href="/landing" className="text-xs text-[#5b534c] hover:text-[#1a2e1a] mb-4 inline-block">
            ← Back to home
          </Link>
          <div className="mb-3 flex items-center gap-2">
            <img src="/logo.svg" width={36} height={36} alt="Katch" style={{ borderRadius: 10 }} />
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1a2e1a",
                fontFamily: "'Playfair Display', 'Instrument Serif', serif",
              }}
            >
              Katch
            </span>
          </div>
          <h1 className="mb-2 text-2xl font-semibold" style={{ color: "#1a2e1a" }}>
            Sign in
          </h1>
          <p className="mb-6 text-sm" style={{ color: "#3b322b" }}>
            Scan badges, enrich contacts, and never drop a lead again.
          </p>

          {error && (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm"
              style={{ color: "#991b1b" }}
            >
              {error}
            </div>
          )}
          {info && (
            <div
              className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm"
              style={{ color: "#166534" }}
            >
              {info}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleFormSubmit}>
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium"
                style={{ color: "#1a2e1a" }}
              >
                Work email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                style={{ backgroundColor: "#fdfbf8", color: "#1a2e1a" }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium"
                style={{ color: "#1a2e1a" }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                style={{ backgroundColor: "#fdfbf8", color: "#1a2e1a" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-[#1a3a2a] bg-[#f0f0ec] px-3 py-2 text-sm font-medium text-[#1a2e1a] cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 hover:bg-[#f7faf4] hover:text-[#1a2e1a] transition-colors"
            >
              {loading ? "Signing in..." : "Continue"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: "#3b322b" }}>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-[#1a2e1a]"
              style={{ color: "#1a2e1a", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
              onClick={() => {
                setMode("signup");
                setError(null);
                setInfo(null);
              }}
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            backgroundColor: "#0a0a0a",
            minHeight: "100vh",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            Loading…
          </p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
