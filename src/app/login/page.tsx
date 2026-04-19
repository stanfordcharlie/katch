"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Mode = "signin" | "signup";

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0a0a",
  backgroundImage: "url('/hero-city.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  padding: "24px 16px",
};

const inputBase: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 12,
  padding: "16px 20px",
  fontSize: 16,
  color: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

function LogoPill() {
  return (
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
      }}
    >
      <div
        style={{
          background: "#1a3a2a",
          borderRadius: 10,
          padding: "6px 10px",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, lineHeight: 1 }}>K</span>
      </div>
      <span style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>Katch</span>
    </div>
  );
}

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

  return (
    <div style={shellStyle}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .auth-input::placeholder {
          color: rgba(255,255,255,0.4);
        }
        .auth-input:focus {
          border: 1px solid rgba(255,255,255,0.5) !important;
          outline: none;
        }
        .auth-input {
          color: #fff !important;
          caret-color: #fff !important;
        }
      `}</style>
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
            className="mb-4 rounded-lg border border-red-400/40 px-3 py-2 text-sm"
            style={{ color: "#fecaca", background: "rgba(127,29,29,0.35)" }}
          >
            {error}
          </div>
        )}
        {info && (
          <div
            className="mb-4 rounded-lg border border-white/20 px-3 py-2 text-sm"
            style={{ color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.08)" }}
          >
            {info}
          </div>
        )}

        {mode === "signup" ? (
          <form onSubmit={handleFormSubmit}>
            <div key={step} style={{ animation: "slideUp 0.4s ease forwards" }}>
              <LogoPill />
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
                  className="auth-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleSignupFieldKeyDown}
                  placeholder="Your name"
                  autoComplete="name"
                  autoFocus
                  style={{ ...inputBase, marginTop: 24, color: "#fff", caretColor: "#fff" }}
                />
              )}
              {step === 1 && (
                <input
                  className="auth-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleSignupFieldKeyDown}
                  placeholder="you@company.com"
                  autoComplete="email"
                  autoFocus
                  style={{ ...inputBase, marginTop: 24, color: "#fff", caretColor: "#fff" }}
                />
              )}
              {step === 2 && (
                <input
                  className="auth-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleSignupFieldKeyDown}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  autoFocus
                  style={{ ...inputBase, marginTop: 24, color: "#fff", caretColor: "#fff" }}
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
        ) : (
          <form onSubmit={handleFormSubmit}>
            <div style={{ animation: "slideUp 0.4s ease forwards" }}>
              <LogoPill />
              <p
                style={{
                  marginTop: 20,
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Sign in
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
                Welcome back.
              </h2>

              <input
                className="auth-input"
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Work email"
                autoComplete="username"
                required
                style={{ ...inputBase, marginTop: 24 }}
              />
              <input
                className="auth-input"
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
                style={{ ...inputBase, marginTop: 16 }}
              />

              <button
                type="submit"
                disabled={loading}
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
                {loading ? "Signing in..." : "Continue"}
              </button>
            </div>
          </form>
        )}

        {mode === "signup" && (
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
        )}

        <p style={{ marginTop: 28, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
          {mode === "signup" ? (
            <>
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
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setInfo(null);
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
                Sign up
              </button>
            </>
          )}
        </p>
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
            ...shellStyle,
            color: "#fff",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
            }}
          />
          <p className="text-sm" style={{ position: "relative", zIndex: 1, color: "rgba(255,255,255,0.5)" }}>
            Loading…
          </p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
