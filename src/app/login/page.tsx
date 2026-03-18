"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/scan");
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

          <form className="space-y-4" onSubmit={handleSubmit}>
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
        </div>
      </div>
    </div>
  );
}
