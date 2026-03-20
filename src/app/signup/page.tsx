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
        if (!data.session || data.user?.identities?.length === 0) {
          setShowConfirmation(true);
        } else {
          onSuccess();
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-lg mx-auto border border-[#dce8d0] rounded-2xl bg-white/90 p-5 md:p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.22em] uppercase text-[#7ab648] mb-1">
            SIGN UP
          </p>
          <h2 className="heading-font text-xl tracking-[-0.03em] text-[#1a2e1a]">
            {PLANS[selectedPlan].name}
          </h2>
          <p className="text-xs text-[#5b534c]">
            {PLANS[selectedPlan].subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onBack();
            setError(null);
          }}
          className="text-[11px] underline underline-offset-4 decoration-[#d4cdc3] hover:text-[#1a2e1a] hover:decoration-[#7ab648] transition-colors cursor-pointer"
          style={{ color: "#7a7067" }}
        >
          Back to plans
        </button>
      </div>

      <div style={{ minHeight: "40px" }}>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm" style={{ color: "#991b1b" }}>
            {error}
          </div>
        )}
      </div>

      {showConfirmation ? (
        <div style={{ textAlign: "center", padding: "12px 4px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#7dde3c" strokeWidth="2.2">
              <path d="M20 7 10 17l-6-6" />
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 8 }}>
            Check your email
          </div>
          <div style={{ fontSize: 14, color: "#999" }}>
            We sent a confirmation link to {email}. Click it to activate your account.
          </div>
          <div style={{ fontSize: 12, color: "#bbb", marginTop: 8 }}>
            Didn&apos;t get it? Check your spam folder.
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-4">
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
            className="w-full rounded-lg border border-[#d4cdc3] bg-[#f0f0ec] px-3 py-2 text-sm outline-none focus:border-[#7ab648] focus:ring-1 focus:ring-[#7ab648]"
            style={{ color: "#1a2e1a", height: "44px", fontSize: 16 }}
          />
        </div>

        <div>
          <label
            htmlFor="screen-name"
            className="mb-1 block text-sm font-medium"
            style={{ color: "#1a2e1a" }}
          >
            Screen Name
          </label>
          <input
            id="screen-name"
            type="text"
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
            required
            placeholder="Your name in the app"
            className="w-full rounded-lg border border-[#d4cdc3] bg-[#f0f0ec] px-3 py-2 text-sm outline-none focus:border-[#7ab648] focus:ring-1 focus:ring-[#7ab648]"
            style={{ color: "#1a2e1a", height: "44px", fontSize: 16 }}
          />
        </div>

        <div>
          <label
            htmlFor="company"
            className="mb-1 block text-sm font-medium"
            style={{ color: "#1a2e1a" }}
          >
            Company Name
          </label>
          <input
            id="company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Acme Inc."
            className="w-full rounded-lg border border-[#d4cdc3] bg-[#f0f0ec] px-3 py-2 text-sm outline-none focus:border-[#7ab648] focus:ring-1 focus:ring-[#7ab648]"
            style={{ color: "#1a2e1a", height: "44px", fontSize: 16 }}
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="mb-1 block text-sm font-medium"
            style={{ color: "#1a2e1a" }}
          >
            Phone Number
          </label>
          <input
            id="phone"
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="w-full rounded-lg border border-[#d4cdc3] bg-[#f0f0ec] px-3 py-2 text-sm outline-none focus:border-[#7ab648] focus:ring-1 focus:ring-[#7ab648]"
            style={{ color: "#1a2e1a", height: "44px", fontSize: 16 }}
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
            className="w-full rounded-lg border border-[#d4cdc3] bg-[#f0f0ec] px-3 py-2 text-sm outline-none focus:border-[#7ab648] focus:ring-1 focus:ring-[#7ab648]"
            style={{ color: "#1a2e1a", height: "44px", fontSize: 16 }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 inline-flex w-full items-center justify-center rounded-full border border-[#1a3a2a] bg-[#f0f0ec] px-4 py-2.5 text-sm font-medium cursor-pointer hover:bg-[#f7faf4] hover:text-[#1a2e1a] transition-colors disabled:cursor-not-allowed disabled:opacity-70"
          style={{ color: "#1a2e1a" }}
        >
          {loading ? "Creating your account..." : "Create account"}
        </button>
      </form>
      )}

      <p className="mt-4 text-[11px] text-[#7a7067]">
        Already have a Katch account?{" "}
        <button
          type="button"
          onClick={onLogin}
          className="underline underline-offset-4 decoration-[#d4cdc3] hover:text-[#1a2e1a] hover:decoration-[#7ab648] transition-colors cursor-pointer"
          style={{ color: "#1a2e1a" }}
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/home");
      }
    });
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f0f0ec",
        color: "#1a2e1a",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500;600&display=swap');
html, body {
  font-family: 'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.heading-font {
  font-family: 'Cormorant Garamond', "Times New Roman", serif;
}
`,
        }}
      />

      <main className="max-w-5xl mx-auto px-4 py-10 md:py-16">
        {/* Header */}
        <header className="mb-10 md:mb-12 flex items-center justify-between gap-4">
          <a href="/landing" className="flex items-center gap-2 text-[#1a2e1a] no-underline">
            <img src="/logo.svg" width={36} height={36} alt="Katch" style={{ borderRadius: 10 }} />
            <span
              className="heading-font tracking-tight text-[#1a2e1a]"
              style={{ fontSize: 19, lineHeight: 1.1 }}
            >
              Katch
            </span>
          </a>
          <button
            type="button"
            className="text-xs underline underline-offset-4 decoration-[#d4cdc3] hover:text-[#1a2e1a] hover:decoration-[#7ab648] transition-colors cursor-pointer"
            style={{ color: "#5b534c" }}
            onClick={() => router.push("/login")}
          >
            Already have an account? Log in
          </button>
        </header>

        {/* Intro copy */}
        <section className="mb-8 md:mb-10 max-w-2xl">
          <p className="text-[11px] tracking-[0.22em] uppercase text-[#7ab648] mb-2">
            PRICING
          </p>
          <h1 className="heading-font text-3xl md:text-[2.2rem] tracking-[-0.03em] text-[#1a2e1a] mb-3">
            Pick your plan, start scanning.
          </h1>
          <p className="text-sm md:text-[0.9rem] text-[#5b534c]">
            Start with a free trial or go straight to Pro. No implementation project, no revops
            ticket — just a clean way to capture and follow up on every conference lead.
          </p>
        </section>

        {/* Pricing cards */}
        {!selectedPlan && (
          <section className="grid md:grid-cols-3 gap-5 md:gap-6 mb-10 md:mb-14">
            {/* Free Trial */}
            <div className="flex flex-col rounded-2xl border border-[#dce8d0] bg-white/90 p-5 md:p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="heading-font text-xl tracking-[-0.03em] text-[#1a2e1a] mb-1">
                  Free Trial
                </h2>
                <p className="text-xs text-[#5b534c]">$0 · no credit card required</p>
              </div>
              <div className="mb-4">
                <span className="text-2xl heading-font text-[#1a2e1a] tracking-[-0.03em]">
                  $0
                </span>
                <span className="ml-1 text-xs text-[#7a7067]">/ month</span>
              </div>
              <ul className="mb-5 space-y-1.5 text-xs text-[#5b534c]">
                <li>• 10 badge scans per month</li>
                <li>• Basic contact extraction</li>
                <li>• 1 event</li>
                <li>• No AI sequences</li>
              </ul>
              <button
                type="button"
                onClick={() => setSelectedPlan("free")}
                className="mt-auto inline-flex w-full items-center justify-center rounded-full border border-[#1a3a2a] bg-[#f0f0ec] px-4 py-2 text-xs font-medium cursor-pointer hover:bg-[#f7faf4] hover:text-[#1a2e1a] transition-colors"
                style={{ color: "#1a2e1a" }}
              >
                Start free trial
              </button>
            </div>

            {/* Pro - Most popular */}
            <div className="relative flex flex-col rounded-2xl border border-[#7ab648] bg-white p-5 md:p-6 shadow-md md:-mt-2">
              <div className="absolute -top-3 left-4 rounded-full bg-[#7ab648] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[#1a3a2a] shadow-sm">
                Most popular
              </div>
              <div className="mb-4 pt-2">
                <h2 className="heading-font text-xl tracking-[-0.03em] text-[#1a2e1a] mb-1">
                  Pro
                </h2>
                <p className="text-xs text-[#5b534c]">For reps who live on the show floor</p>
              </div>
              <div className="mb-4">
                <span className="text-2xl heading-font text-[#1a2e1a] tracking-[-0.03em]">
                  $49.99
                </span>
                <span className="ml-1 text-xs text-[#7a7067]">/ month per user</span>
              </div>
              <ul className="mb-5 space-y-1.5 text-xs text-[#5b534c]">
                <li>• Unlimited badge scans</li>
                <li>• Claude Vision + Apollo enrichment</li>
                <li>• Unlimited events</li>
                <li>• AI follow-up sequences</li>
                <li>• Pipeline dashboard</li>
                <li>• CRM sync</li>
              </ul>
              <button
                type="button"
                onClick={() => setSelectedPlan("pro")}
                className="mt-auto inline-flex w-full items-center justify-center rounded-full border border-[#1a3a2a] bg-[#f0f0ec] px-4 py-2 text-xs font-medium cursor-pointer hover:bg-[#f7faf4] hover:text-[#1a2e1a] transition-colors"
                style={{ color: "#1a2e1a" }}
              >
                Get started
              </button>
            </div>

            {/* Enterprise */}
            <div className="flex flex-col rounded-2xl border border-[#dce8d0] bg-white/90 p-5 md:p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="heading-font text-xl tracking-[-0.03em] text-[#1a2e1a] mb-1">
                  Enterprise
                </h2>
                <p className="text-xs text-[#5b534c]">For field marketing and large sales orgs</p>
              </div>
              <div className="mb-4">
                <span className="text-2xl heading-font text-[#1a2e1a] tracking-[-0.03em]">
                  Custom
                </span>
                <span className="ml-1 text-xs text-[#7a7067]">pricing</span>
              </div>
              <ul className="mb-5 space-y-1.5 text-xs text-[#5b534c]">
                <li>• Everything in Pro</li>
                <li>• Team management + SSO</li>
                <li>• Dedicated onboarding</li>
                <li>• Custom CRM integrations</li>
                <li>• SLA + priority support</li>
              </ul>
              <a
                href="mailto:hello@katch.app"
                className="mt-auto inline-flex w-full items-center justify-center rounded-full border border-[#d4cdc3] bg-[#f0f0ec] px-4 py-2 text-xs font-medium cursor-pointer hover:bg-[#f7faf4] hover:border-[#dce8d0] hover:text-[#1a2e1a] transition-colors"
                style={{ color: "#1a2e1a" }}
              >
                Contact us
              </a>
            </div>
          </section>
        )}

        {/* Signup form — isolated so keystrokes only re-render this section */}
        {selectedPlan && (
          <SignupForm
            initialEmail={emailParam ?? ""}
            selectedPlan={selectedPlan}
            onBack={() => setSelectedPlan(null)}
            onSuccess={() => router.push("/home")}
            onLogin={() => router.push("/login")}
          />
        )}
      </main>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f7f7f5" }} />}>
      <SignupInner />
    </Suspense>
  );
}
