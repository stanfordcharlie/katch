"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

const featureItems = [
  {
    title: "Scan any badge",
    desc: "Claude Vision reads badges and business cards instantly. No QR codes needed.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a3a2a" strokeWidth="1.8">
        <path d="M3 9V5a2 2 0 012-2h4M3 15v4a2 2 0 002 2h4M21 9V5a2 2 0 00-2-2h-4M21 15v4a2 2 0 01-2 2h-4" />
      </svg>
    ),
  },
  {
    title: "AI lead scoring",
    desc: "Every contact scored against your ICP automatically. Know who to follow up with first.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a3a2a" strokeWidth="1.8">
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Smart enrichment",
    desc: "Get talking points, red flags, and ICP fit reasons for every contact you meet.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a3a2a" strokeWidth="1.8">
        <path d="M12 5a3 3 0 00-3 3v1H7a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2h-2V8a3 3 0 00-3-3z" />
        <path d="M9 14h6M10 11h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "HubSpot sync",
    desc: "Push contacts and AI insights to HubSpot in one click. Notes, scores, and signals included.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a3a2a" strokeWidth="1.8">
        <path d="M4 12a8 8 0 0113.9-5M20 12a8 8 0 01-13.9 5" strokeLinecap="round" />
        <path d="M8 12h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Lead list analysis",
    desc: "Upload a conference attendee list and rank every lead before the event starts.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a3a2a" strokeWidth="1.8">
        <path d="M4 6h16M4 12h10M4 18h14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Email sequences",
    desc: "Generate personalized follow-up sequences for each contact based on your conversation.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a3a2a" strokeWidth="1.8">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function LandingPageV2() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const navPad = isMobile ? "0 20px" : "0 40px";

  return (
    <div style={{ backgroundColor: "#ffffff", overflowX: "hidden", fontFamily: "Inter, system-ui, sans-serif" }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      />
      <style>{`html, body { background: #ffffff !important; }`}</style>
      <style
        dangerouslySetInnerHTML={{
          __html: `
select option { color: #111; background: #fff; }
.landing-nav-link { transition: color 0.2s ease; }
.landing-nav-link:hover { color: #111 !important; }
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
        <a href="#" style={{ textDecoration: "none", color: "inherit" }}>
          <LogoLockup />
        </a>
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 32, position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
            <a href="#how" className="landing-nav-link" style={{ fontSize: 14, color: "#666", cursor: "pointer", textDecoration: "none" }}>
              How it works
            </a>
            <a href="#features" className="landing-nav-link" style={{ fontSize: 14, color: "#666", cursor: "pointer", textDecoration: "none" }}>
              Features
            </a>
            <a href="#pricing" className="landing-nav-link" style={{ fontSize: 14, color: "#666", cursor: "pointer", textDecoration: "none" }}>
              Pricing
            </a>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
          {isLoggedIn ? (
            <button
              type="button"
              onClick={() => router.push("/home")}
              style={{
                background: "#1a3a2a",
                color: "#fff",
                borderRadius: 10,
                padding: isMobile ? "9px 14px" : "9px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
              }}
            >
              Go to app
            </button>
          ) : (
            <>
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
                Get started free
              </button>
            </>
          )}
        </div>
      </nav>

      <section
        style={{
          minHeight: "100vh",
          background: "#ffffff",
          position: "relative",
          overflow: "hidden",
          paddingTop: 64,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            opacity: 0.5,
            backgroundImage:
              "repeating-linear-gradient(0deg, #e8ebe8, #e8ebe8 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #e8ebe8, #e8ebe8 1px, transparent 1px, transparent 40px)",
            backgroundSize: "40px 40px",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.6) 60%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            maxWidth: 760,
            margin: "0 auto",
            padding: isMobile ? "72px 24px 48px" : "120px 24px 80px",
          }}
        >
          <h1
            style={{
              fontSize: isMobile ? 40 : 64,
              fontWeight: 800,
              color: "#0a0a0a",
              lineHeight: 1.1,
              letterSpacing: "-2px",
              marginBottom: 20,
            }}
          >
            Scan it. Score it.
            <br />
            <span style={{ color: "#1a3a2a" }}>Close it.</span>
          </h1>
          <p
            style={{
              fontSize: isMobile ? 17 : 20,
              color: "#666",
              lineHeight: 1.6,
              maxWidth: 540,
              margin: "0 auto 40px",
            }}
          >
            The AI-powered GTM platform for in-person events. Stop forgetting leads. Start closing deals.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => router.push("/signup")}
              style={{
                background: "#1a3a2a",
                color: "#fff",
                borderRadius: 12,
                padding: "14px 28px",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
              }}
            >
              Get started free
            </button>
            <a
              href="#how"
              style={{
                background: "#fff",
                border: "1px solid #e0e0e0",
                color: "#111",
                borderRadius: 12,
                padding: "14px 28px",
                fontSize: 16,
                fontWeight: 500,
                cursor: "pointer",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              See how it works
            </a>
          </div>
          <p style={{ fontSize: 13, color: "#999", marginTop: 16 }}>Free to start. No credit card required.</p>

          <div
            style={{
              background: "linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 30%, #1e4d6b 70%, #0f2a3d 100%)",
              borderRadius: 20,
              height: isMobile ? 280 : 420,
              maxWidth: 900,
              margin: "60px auto 0",
              border: "1px solid #e0e0e0",
              boxShadow: "0 40px 80px rgba(0,0,0,0.12)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                height: 44,
                background: "rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                gap: 8,
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 99, background: "rgba(255,255,255,0.2)" }} />
              <span style={{ width: 10, height: 10, borderRadius: 99, background: "rgba(255,255,255,0.2)" }} />
              <span style={{ width: 10, height: 10, borderRadius: 99, background: "rgba(255,255,255,0.2)" }} />
            </div>
            <div style={{ padding: 16 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ width: 36, height: 10, borderRadius: 4, background: "rgba(255,255,255,0.15)" }} />
                  <div style={{ flex: 1, height: 10, borderRadius: 4, background: "rgba(255,255,255,0.1)" }} />
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 700,
                      background: i % 3 === 0 ? "#7dde3c" : "#f59e0b",
                      color: i % 3 === 0 ? "#0a1a0a" : "#111",
                    }}
                  >
                    {i % 3 === 0 ? "8" : "5"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" style={{ background: "#ffffff", padding: isMobile ? "80px 24px" : "100px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#7dde3c",
              letterSpacing: "0.15em",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            FEATURES
          </div>
          <h2
            style={{
              fontSize: isMobile ? 28 : 40,
              fontWeight: 800,
              color: "#111",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            Everything you need at a conference
          </h2>
          <p
            style={{
              fontSize: 18,
              color: "#666",
              textAlign: "center",
              marginBottom: 64,
            }}
          >
            From badge to CRM in seconds. No manual entry, no lost leads.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
              gap: 32,
            }}
          >
            {featureItems.map((f) => (
              <div
                key={f.title}
                style={{
                  background: "#f8f9f8",
                  borderRadius: 16,
                  padding: "28px 24px",
                  border: "1px solid #ebebeb",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "#f0f7eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  {f.icon}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#111", marginBottom: 8 }}>{f.title}</div>
                <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" style={{ background: "#f8f9f8", padding: isMobile ? "80px 24px" : "100px 40px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#7dde3c",
              letterSpacing: "0.15em",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            HOW IT WORKS
          </div>
          <h2
            style={{
              fontSize: isMobile ? 28 : 36,
              fontWeight: 800,
              color: "#111",
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            How Katch works
          </h2>
          <p style={{ fontSize: 18, color: "#666", textAlign: "center", marginBottom: 48 }}>
            Three steps from handshake to pipeline.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "stretch" : "flex-start",
              gap: isMobile ? 32 : 0,
            }}
          >
            {[
              { n: 1, t: "Scan", d: "Capture badges and cards with your camera." },
              { n: 2, t: "Score", d: "AI scores every lead against your ICP." },
              { n: 3, t: "Close", d: "Sync to HubSpot and run sequences." },
            ].map((step, idx) => (
              <div key={step.n} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative" }}>
                {!isMobile && idx < 2 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 20,
                      left: "calc(50% + 28px)",
                      width: "calc(100% - 56px)",
                      borderTop: "2px dashed #d0d0d0",
                      zIndex: 0,
                    }}
                  />
                )}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 99,
                    background: "#1a3a2a",
                    color: "#fff",
                    fontSize: 18,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {step.n}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#111", marginTop: 16 }}>{step.t}</div>
                <p style={{ fontSize: 14, color: "#666", marginTop: 8, marginBottom: 0, maxWidth: 220 }}>{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" style={{ background: "#ffffff", padding: isMobile ? "64px 24px" : "80px 40px", textAlign: "center" }}>
        <h2 style={{ fontSize: isMobile ? 28 : 36, fontWeight: 800, color: "#111", marginBottom: 12 }}>Simple pricing</h2>
        <p style={{ fontSize: 18, color: "#666", marginBottom: 40 }}>Start free, upgrade when you need more.</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 24,
            maxWidth: 600,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              background: "#f8f9f8",
              border: "1px solid #ebebeb",
              borderRadius: 16,
              padding: "28px 24px",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#666", marginBottom: 8 }}>Free</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#111", marginBottom: 16 }}>
              $0<span style={{ fontSize: 16, fontWeight: 500, color: "#666" }}>/mo</span>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", fontSize: 14, color: "#666", lineHeight: 1.8 }}>
              <li>Core scanning and scoring</li>
              <li>Limited enrichments per month</li>
              <li>Single user</li>
            </ul>
            <button
              type="button"
              onClick={() => router.push("/signup")}
              style={{
                width: "100%",
                background: "#fff",
                border: "1px solid #e0e0e0",
                color: "#111",
                borderRadius: 10,
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Get started
            </button>
          </div>
          <div
            style={{
              background: "#1a3a2a",
              border: "1px solid #1a3a2a",
              borderRadius: 16,
              padding: "28px 24px",
              textAlign: "left",
              position: "relative",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7dde3c", marginBottom: 8 }}>PRO</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 16 }}>
              $49<span style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>/mo</span>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.8 }}>
              <li>Unlimited scans and lists</li>
              <li>HubSpot sync and sequences</li>
              <li>Priority support</li>
            </ul>
            <button
              type="button"
              onClick={() => router.push("/pricing")}
              style={{
                width: "100%",
                background: "#7dde3c",
                color: "#0a1a0a",
                border: "none",
                borderRadius: 10,
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              View all plans
            </button>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 30%, #1e4d6b 70%, #0f2a3d 100%)",
          padding: isMobile ? "64px 24px" : "80px 40px",
          textAlign: "center",
          borderRadius: 24,
          maxWidth: 900,
          margin: isMobile ? "0 16px 64px" : "0 auto 80px",
        }}
      >
        <h2 style={{ fontSize: isMobile ? 28 : 40, fontWeight: 800, color: "#fff", marginBottom: 16 }}>Ready to close more deals?</h2>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", marginBottom: 32 }}>
          Join teams who never lose a lead at the booth again.
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
    </div>
  );
}
