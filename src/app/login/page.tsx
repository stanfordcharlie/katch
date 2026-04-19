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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
            {mode === "signup" ? "Sign up" : "Sign in"}
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

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div>
                <label
                  htmlFor="name"
                  className="mb-1 block text-sm font-medium"
                  style={{ color: "#1a2e1a" }}
                >
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                  style={{ backgroundColor: "#fdfbf8", color: "#1a2e1a" }}
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium"
                style={{ color: "#1a2e1a" }}
              >
                {mode === "signup" ? "Email" : "Work email"}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete={mode === "signup" ? "email" : "username"}
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
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                style={{ backgroundColor: "#fdfbf8", color: "#1a2e1a" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-[#1a3a2a] bg-[#f0f0ec] px-3 py-2 text-sm font-medium text-[#1a2e1a] cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 hover:bg-[#f7faf4] hover:text-[#1a2e1a] transition-colors"
            >
              {loading
                ? mode === "signup"
                  ? "Creating account..."
                  : "Signing in..."
                : mode === "signup"
                  ? "Create account"
                  : "Continue"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: "#3b322b" }}>
            {mode === "signin" ? (
              <>
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
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-[#1a2e1a]"
                  style={{ color: "#1a2e1a", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                    setInfo(null);
                  }}
                >
                  Sign in
                </button>
              </>
            )}
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
            backgroundColor: "#f0f0ec",
            minHeight: "100vh",
            color: "#1a2e1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p className="text-sm text-[#3b322b]">Loading…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
