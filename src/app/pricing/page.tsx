"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

function LogoLockup({ small }: { small?: boolean }) {
  const fs = small ? 15 : 18;
  const box = small ? 28 : 32;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div
        style={{
          width: box,
          height: box,
          borderRadius: 10,
          background: "#f0f2f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ScanFrameIcon />
      </div>
      <span style={{ fontWeight: 700, fontSize: fs, color: "#111", marginLeft: 10 }}>Katch</span>
    </div>
  );
}

export default function PricingPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll<HTMLElement>(".reveal");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const navPad = isMobile ? "0 20px" : "0 40px";

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      />
      <style>{`html, body { background: #ffffff !important; }`}</style>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.5s ease, transform 0.5s ease; }
.reveal.visible { opacity: 1; transform: translateY(0); }
.pricing-nav-link { transition: color 0.2s ease; }
.pricing-nav-link:hover { color: #111 !important; }
`,
        }}
      />

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
        {!isMobile && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 32,
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <a href="/landing" className="pricing-nav-link" style={{ fontSize: 14, color: "#666", textDecoration: "none" }}>
              Product
            </a>
            <a href="/pricing" className="pricing-nav-link" style={{ fontSize: 14, color: "#666", textDecoration: "none" }}>
              Pricing
            </a>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => router.push("/login")}
            style={{
              color: "#666",
              fontSize: 14,
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: "4px 8px",
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => router.push("/signup")}
            style={{
              background: "#1a3a2a",
              color: "#fff",
              borderRadius: 10,
              padding: "9px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
            }}
          >
            Get started
          </button>
        </div>
      </nav>

      <main style={{ paddingTop: 120 }}>
        <header
          className="reveal"
          style={{
            textAlign: "center",
            maxWidth: 700,
            margin: "0 auto",
            paddingBottom: 60,
            paddingLeft: isMobile ? 24 : 0,
            paddingRight: isMobile ? 24 : 0,
          }}
        >
          <div
            style={{
              background: "#f0f7eb",
              border: "1px solid #d4edbc",
              color: "#2d6a1f",
              borderRadius: 99,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 600,
              display: "inline-block",
              marginBottom: 16,
            }}
          >
            PRICING
          </div>
          <h1
            style={{
              fontSize: isMobile ? 34 : 48,
              fontWeight: 800,
              color: "#0a0a0a",
              letterSpacing: "-1px",
              marginBottom: 12,
              lineHeight: 1.1,
            }}
          >
            Simple pricing. No surprises.
          </h1>
          <p style={{ fontSize: 18, color: "#666", lineHeight: 1.5 }}>
            Start free, scale when you are ready. Cancel anytime.
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "#f0f0f0",
              borderRadius: 99,
              padding: 4,
              marginTop: 24,
            }}
          >
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              style={{
                borderRadius: 99,
                padding: "8px 20px",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                border: "none",
                background: billing === "monthly" ? "#1a3a2a" : "transparent",
                color: billing === "monthly" ? "#fff" : "#666",
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              style={{
                borderRadius: 99,
                padding: "8px 20px",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                border: "none",
                background: billing === "annual" ? "#1a3a2a" : "transparent",
                color: billing === "annual" ? "#fff" : "#666",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Annual
              <span
                style={{
                  background: "#7dde3c",
                  color: "#0a1a0a",
                  borderRadius: 99,
                  padding: "2px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  marginLeft: 6,
                }}
              >
                Save 20%
              </span>
            </button>
          </div>
        </header>

        <section
          className="reveal"
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
            gap: 24,
            maxWidth: 1100,
            margin: "0 auto",
            padding: isMobile ? "0 24px 80px" : "0 40px 80px",
          }}
        >
          {/* Free */}
          <article
            style={{
              background: "#ffffff",
              border: "1px solid #e8e8e8",
              borderRadius: 20,
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 8 }}>Free</div>
              <div style={{ fontSize: 48, fontWeight: 800, color: "#111", lineHeight: 1.1 }}>$0</div>
              <div style={{ fontSize: 14, color: "#999", marginTop: 4 }}>Forever</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>10 scans per month</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Basic contact export (CSV)</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>1 event</span>
                </li>
                <li
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: 14,
                    color: "#bbb",
                    textDecoration: "line-through",
                  }}
                >
                  <span style={{ flexShrink: 0 }}>✕</span>
                  <span>AI email sequences</span>
                </li>
                <li
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: 14,
                    color: "#bbb",
                    textDecoration: "line-through",
                  }}
                >
                  <span style={{ flexShrink: 0 }}>✕</span>
                  <span>Lead scoring 1–10</span>
                </li>
                <li
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: 14,
                    color: "#bbb",
                    textDecoration: "line-through",
                  }}
                >
                  <span style={{ flexShrink: 0 }}>✕</span>
                  <span>HubSpot import</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
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
              }}
            >
              Get started free
            </button>
          </article>

          {/* Solo */}
          <article
            style={{
              background: "#ffffff",
              border: "1px solid #e8e8e8",
              borderRadius: 20,
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 8 }}>Solo</div>
              <div style={{ fontSize: 48, fontWeight: 800, color: "#111", lineHeight: 1.1 }}>$29</div>
              <div style={{ fontSize: 14, color: "#999", marginTop: 4 }}>Per month</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Unlimited scans</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>AI email sequences</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Lead scoring 1–10</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Unlimited events</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>HubSpot CSV export</span>
                </li>
                <li
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: 14,
                    color: "#bbb",
                    textDecoration: "line-through",
                  }}
                >
                  <span style={{ flexShrink: 0 }}>✕</span>
                  <span>Team collaboration</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              style={{
                width: "100%",
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 24,
                background: "#1a3a2a",
                color: "#fff",
                border: "none",
              }}
            >
              Start free trial
            </button>
          </article>

          {/* Team */}
          <article
            style={{
              background: "#ffffff",
              border: "2px solid #7dde3c",
              borderRadius: 20,
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 8px 40px rgba(125,222,60,0.15)",
            }}
          >
            <div>
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
                }}
              >
                MOST POPULAR
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 8 }}>Team</div>
              <div style={{ fontSize: 48, fontWeight: 800, color: "#111", lineHeight: 1.1 }}>$79</div>
              <div style={{ fontSize: 14, color: "#999", marginTop: 4 }}>Per month · up to 5 users</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Everything in Solo</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Up to 5 seats</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Shared contact pool</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Team dashboard & analytics</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Attendee list analysis</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Priority support</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              style={{
                width: "100%",
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 24,
                background: "#7dde3c",
                color: "#0a1a0a",
                border: "none",
              }}
            >
              Start free trial
            </button>
          </article>

          {/* Enterprise */}
          <article
            style={{
              background: "#ffffff",
              border: "1px solid #e8e8e8",
              borderRadius: 20,
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 8 }}>Enterprise</div>
              <div style={{ fontSize: 48, fontWeight: 800, color: "#111", lineHeight: 1.1 }}>Custom</div>
              <div style={{ fontSize: 14, color: "#999", marginTop: 4 }}>Talk to sales</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Everything in Team</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Unlimited seats</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>CRM integrations (Salesforce, HubSpot)</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>SSO & admin controls</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Dedicated CSM</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "#444" }}>
                  <span style={{ color: "#2d6a1f", flexShrink: 0 }}>✓</span>
                  <span>Custom onboarding</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
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
              }}
            >
              Talk to sales
            </button>
          </article>
        </section>

        <section
          style={{
            background: "linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 30%, #1e4d6b 70%, #0f2a3d 100%)",
            borderRadius: 24,
            maxWidth: 900,
            margin: isMobile ? "40px 16px 80px" : "40px auto 80px",
            padding: isMobile ? "48px 24px" : "60px 40px",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: isMobile ? 28 : 36, fontWeight: 800, color: "#fff", marginBottom: 12 }}>Questions?</h2>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", marginBottom: 28 }}>
            Start free today — no credit card required.
          </p>
          <button
            type="button"
            onClick={() => router.push("/signup")}
            style={{
              background: "#7dde3c",
              color: "#0a1a0a",
              borderRadius: 12,
              padding: "14px 32px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
            }}
          >
            Get started free
          </button>
        </section>

        <footer
          style={{
            background: "#f8f9f8",
            borderTop: "1px solid #ebebeb",
            padding: isMobile ? "32px 24px" : "40px 40px",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: isMobile ? 20 : 0,
          }}
        >
          <LogoLockup small />
          <div style={{ display: "flex", gap: 24 }}>
            <a href="#" style={{ fontSize: 13, color: "#999", textDecoration: "none" }}>
              Privacy
            </a>
            <a href="#" style={{ fontSize: 13, color: "#999", textDecoration: "none" }}>
              Terms
            </a>
            <a href="mailto:hello@katch.app" style={{ fontSize: 13, color: "#999", textDecoration: "none" }}>
              Contact
            </a>
          </div>
          <span style={{ fontSize: 13, color: "#bbb" }}>2026 Katch</span>
        </footer>
      </main>
    </div>
  );
}
