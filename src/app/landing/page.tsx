"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.querySelector('input[type="email"]') as HTMLInputElement | null;
    const email = input?.value || "";
    router.push(`/signup?email=${encodeURIComponent(email)}`);
  };

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

  return (
    <div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

::root {
  --cream: #f0f0ec;
  --ink: #1a2e1a;
  --ink-50: #7a9a7a;
  --ink-20: rgba(26,46,26,0.12);
  --copper: #d4874a;
  --copper-light: rgba(212,135,74,0.12);
  --blue: #7ab648;
  --stone: #dce8d0;
}

html { scroll-behavior: smooth; }
body {
  font-family: 'Geist', system-ui, sans-serif;
  background: var(--cream);
  color: var(--ink);
  overflow-x: hidden;
}

/* NAV */
nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 40px;
  background: rgba(240,240,236,0.88);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid #dce8d0;
}

.nav-logo {
  display: flex; align-items: center; gap: 10px;
  text-decoration: none; color: var(--ink);
}

.logo-mark {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--cream); border: 1px solid var(--stone);
  display: grid; place-items: center;
  position: relative; overflow: hidden;
}

/* scan frame logo */
.logo-mark::before {
  content: '';
  position: absolute; top: 6px; left: 6px;
  width: 8px; height: 8px;
  border-top: 2px solid var(--blue);
  border-left: 2px solid var(--blue);
  border-radius: 1px;
}
.logo-mark::after {
  content: '';
  position: absolute; bottom: 6px; right: 6px;
  width: 8px; height: 8px;
  border-bottom: 2px solid var(--copper);
  border-right: 2px solid var(--copper);
  border-radius: 1px;
}

.logo-inner-tl { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-top: 2px solid var(--blue); border-right: 2px solid var(--blue); border-radius: 1px; }
.logo-inner-bl { position: absolute; bottom: 6px; left: 6px; width: 8px; height: 8px; border-bottom: 2px solid var(--copper); border-left: 2px solid var(--copper); border-radius: 1px; }

.logo-name {
  font-family: 'Instrument Serif', serif;
  font-size: 26px; letter-spacing: -0.02em; color: var(--ink);
}

.nav-links { display: flex; gap: 28px; }
.nav-links a {
  font-size: 15px; color: var(--ink-50); text-decoration: none;
  transition: color 0.2s; font-weight: 400;
}
.nav-links a:hover { color: var(--ink); }

.nav-actions { display: flex; align-items: center; gap: 10px; }

.btn-ghost {
  font-size: 14px; padding: 8px 16px;
  border: 1px solid var(--stone); border-radius: 100px;
  background: transparent; color: var(--ink); cursor: pointer;
  font-family: 'Geist', sans-serif; transition: all 0.2s;
}
.btn-ghost:hover { background: #f7faf4; border-color: #dce8d0; color: #1a2e1a; }

.btn-solid {
  font-size: 14px; padding: 8px 18px;
  border: 1px solid var(--ink); border-radius: 100px;
  background: var(--ink); color: var(--cream); cursor: pointer;
  font-family: 'Geist', sans-serif; transition: all 0.2s;
}
.btn-solid:hover { background: #152a20; }

/* HERO */
.hero {
  min-height: 100vh;
  padding: 120px 40px 80px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center; position: relative; overflow: hidden;
  background: #f0f0ec;
}

.hero-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 500; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--copper);
  border: 1px solid rgba(196,124,74,0.3);
  padding: 5px 12px; border-radius: 100px;
  margin-bottom: 32px;
  animation: fadeUp 0.6s ease both;
}

.hero-badge-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--copper);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

h1 {
  font-family: 'Instrument Serif', serif;
  font-size: clamp(56px, 8vw, 100px);
  line-height: 1.0;
  letter-spacing: -0.03em;
  color: var(--ink);
  max-width: 900px;
  margin-bottom: 24px;
  animation: fadeUp 0.6s 0.1s ease both;
}

h1 em { font-style: italic; color: var(--copper); }

.hero-sub {
  font-size: 17px; font-weight: 300; line-height: 1.6;
  color: var(--ink-50); max-width: 480px; margin-bottom: 40px;
  animation: fadeUp 0.6s 0.2s ease both;
}

.email-form {
  display: flex; align-items: center;
  background: white; border: 1px solid var(--stone);
  border-radius: 100px; padding: 6px 6px 6px 20px;
  max-width: 440px; width: 100%; gap: 8px;
  box-shadow: 0 4px 24px rgba(24,22,15,0.06);
  animation: fadeUp 0.6s 0.3s ease both;
}

.email-form input {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 14px; font-family: 'Geist', sans-serif;
  color: var(--ink); min-width: 0;
}

.email-form input::placeholder { color: var(--ink-50); }

.email-form button {
  flex-shrink: 0; padding: 10px 20px;
  background: var(--ink); color: white; border: none;
  border-radius: 100px; font-size: 13px; font-weight: 500;
  font-family: 'Geist', sans-serif; cursor: pointer;
  transition: background 0.2s; white-space: nowrap;
}

.email-form button:hover { background: #2a3a52; }

/* Hero visual */
.hero-visual {
  margin-top: 60px; position: relative; width: 100%; max-width: 900px;
  animation: fadeUp 0.8s 0.4s ease both;
}

.mock-app {
  background: white; border-radius: 20px;
  border: 1px solid var(--stone);
  box-shadow: 0 24px 80px rgba(24,22,15,0.10);
  overflow: hidden;
  display: grid; grid-template-columns: 180px 1fr;
  height: 420px;
}

.mock-sidebar {
  background: var(--cream); border-right: 1px solid var(--stone);
  padding: 20px 12px; display: flex; flex-direction: column; gap: 4px;
}

.mock-logo-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; margin-bottom: 12px;
}
.mock-logo-icon {
  width: 24px; height: 24px; border-radius: 5px;
  background: var(--cream); border: 1px solid var(--stone);
  display: flex; align-items: center; justify-content: center;
}

.mock-logo-text { font-family: 'Instrument Serif', serif; font-size: 16px; }

.mock-nav-item {
  padding: 8px 10px; border-radius: 8px; font-size: 12px;
  color: var(--ink-50); cursor: default;
}
.mock-nav-item.active {
  background: #1a3a2a; color: #a8d878; font-weight: 500;
}

.mock-main { padding: 28px; overflow: hidden; }

.mock-header { margin-bottom: 20px; }
.mock-title { font-family: 'Instrument Serif', serif; font-size: 22px; color: var(--ink); }
.mock-sub { font-size: 12px; color: var(--ink-50); margin-top: 2px; }

.mock-scan-area {
  border: 1.5px dashed var(--stone); border-radius: 14px;
  height: 110px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
  margin-bottom: 16px; background: #f0f0ec;
}

.scan-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: white; border: 1px solid var(--stone);
  display: flex; align-items: center; justify-content: center;
}

.mock-scan-text { font-size: 12px; color: var(--ink-50); }

.mock-contact-card {
  background: white; border: 1px solid var(--stone);
  border-radius: 14px; padding: 14px 16px;
  display: flex; align-items: center; gap: 12px;
}

.mock-avatar {
  width: 38px; height: 38px; border-radius: 50%;
  background: var(--ink); color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 500; flex-shrink: 0;
  font-family: 'Geist', sans-serif;
}

.mock-avatar.copper { background: var(--copper); }

.mock-contact-name { font-size: 14px; font-weight: 500; color: var(--ink); }
.mock-contact-sub { font-size: 11px; color: var(--ink-50); margin-top: 1px; }

.mock-score {
  margin-left: auto; font-size: 11px; font-weight: 500;
  padding: 3px 10px; border-radius: 100px;
  background: #fff4ee; color: var(--copper);
}

.mock-signals {
  display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap;
}

.mock-signal {
  font-size: 10px; padding: 3px 9px; border-radius: 100px;
  border: 1px solid var(--stone); color: var(--ink-50);
}

.mock-signal.active {
  background: var(--ink); color: white; border-color: var(--ink);
}

/* Floating cards */
.float-card {
  position: absolute; background: white;
  border: 1px solid var(--stone); border-radius: 14px;
  padding: 12px 16px; box-shadow: 0 8px 32px rgba(24,22,15,0.10);
  font-size: 12px;
}

.float-card-1 {
  top: -20px; right: -20px;
  animation: float 5s ease-in-out infinite;
}

.float-card-2 {
  bottom: 40px; left: -30px;
  animation: float 5s 1.5s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.float-label { font-size: 10px; color: var(--ink-50); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.08em; }
.float-value { font-family: 'Instrument Serif', serif; font-size: 22px; color: var(--ink); }
.float-sub { font-size: 10px; color: var(--copper); margin-top: 2px; }

/* LOGO BAR */
.logo-bar {
  padding: 20px 40px;
  border-top: 1px solid var(--stone);
  border-bottom: 1px solid var(--stone);
  display: flex; align-items: center; justify-content: center;
  gap: 48px; background: #f0f0ec; flex-wrap: wrap;
}

.logo-bar-label { font-size: 11px; color: var(--ink-50); letter-spacing: 0.08em; text-transform: uppercase; }
.logo-bar-item { font-family: 'Instrument Serif', serif; font-size: 18px; color: rgba(24,22,15,0.25); }

/* STEPS */
.steps-section { padding: 100px 40px; max-width: 1100px; margin: 0 auto; background: rgba(122,182,72,0.08); }

.section-label {
  font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--copper); font-weight: 500; margin-bottom: 16px;
}

h2 {
  font-family: 'Instrument Serif', serif;
  font-size: clamp(36px, 4vw, 52px);
  line-height: 1.1; letter-spacing: -0.02em;
  color: var(--ink); margin-bottom: 56px;
}

h2 em { font-style: italic; color: var(--copper); }

.steps-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px;
  background: var(--stone); border-radius: 18px; overflow: hidden;
}

.step {
  background: white; padding: 32px 24px;
}

.step-num {
  font-family: 'Instrument Serif', serif;
  font-size: 40px; color: var(--stone); line-height: 1;
  margin-bottom: 16px;
}

.step-title { font-size: 15px; font-weight: 500; color: var(--ink); margin-bottom: 8px; }
.step-desc { font-size: 13px; font-weight: 300; line-height: 1.6; color: var(--ink-50); }

/* ROI */
.roi-section {
  padding: 80px 40px;
  background: #f0f0ec;
  border-top: 1px solid #dce8d0;
  border-bottom: 1px solid #dce8d0;
}

.roi-inner {
  max-width: 1100px; margin: 0 auto;
  display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center;
}

.roi-section .section-label { color: #c47c4a; }

.roi-title {
  font-family: 'Instrument Serif', serif;
  font-size: clamp(36px, 4vw, 52px);
  line-height: 1.1; letter-spacing: -0.02em;
  color: #1a2e1a; margin-bottom: 20px;
}

.roi-title em { font-style: italic; color: #c47c4a; }

.roi-sub { font-size: 15px; font-weight: 300; line-height: 1.7; color: rgba(24,22,15,0.6); margin-bottom: 28px; }

.roi-points { list-style: none; display: flex; flex-direction: column; gap: 12px; }
.roi-points li { display: flex; gap: 10px; font-size: 14px; color: rgba(24,22,15,0.7); }
.roi-points li::before { content: '→'; color: #c47c4a; flex-shrink: 0; }

.roi-stats {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}

.roi-stat {
  background: white; border: 1px solid #dce8d0;
  border-radius: 16px; padding: 24px;
}

.roi-stat-num {
  font-family: 'Instrument Serif', serif;
  font-size: 40px; color: #1a2e1a; line-height: 1; margin-bottom: 6px;
}

.roi-stat-num span { color: var(--copper); }
.roi-stat-label { font-size: 12px; color: rgba(24,22,15,0.5); }

/* TESTIMONIALS */
.testimonials { padding: 100px 40px; max-width: 1100px; margin: 0 auto; background: rgba(122,182,72,0.08); }

.testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 56px; }

.testimonial {
  border: 1px solid var(--stone); border-radius: 18px;
  padding: 32px; background: white;
}

.testimonial-quote {
  font-family: 'Instrument Serif', serif; font-style: italic;
  font-size: 17px; line-height: 1.6; color: var(--ink);
  margin-bottom: 24px;
}

.testimonial-author { display: flex; align-items: center; gap: 10px; }

.t-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--ink); color: white; font-size: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-family: 'Geist', sans-serif;
}

.t-avatar.c { background: var(--copper); }
.t-avatar.g { background: #8a9e8c; }

.t-name { font-size: 13px; font-weight: 500; color: var(--ink); }
.t-role { font-size: 11px; color: var(--ink-50); margin-top: 1px; }

/* CTA */
.cta-section {
  padding: 100px 40px; text-align: center;
  border-top: 1px solid var(--stone);
  background: #f0f0ec;
}

.cta-title {
  font-family: 'Instrument Serif', serif;
  font-size: clamp(40px, 5vw, 64px);
  line-height: 1.05; letter-spacing: -0.03em;
  color: var(--ink); margin-bottom: 16px;
}

.cta-title em { font-style: italic; color: var(--copper); }

.cta-sub { font-size: 15px; color: var(--ink-50); margin-bottom: 36px; font-weight: 300; }

.cta-form {
  display: flex; align-items: center; justify-content: center;
  background: white; border: 1px solid var(--stone);
  border-radius: 100px; padding: 6px 6px 6px 24px;
  max-width: 440px; margin: 0 auto;
  box-shadow: 0 4px 24px rgba(24,22,15,0.06);
}

.cta-form input {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 14px; font-family: 'Geist', sans-serif; color: var(--ink);
}

.cta-form input::placeholder { color: var(--ink-50); }

.cta-form button {
  padding: 10px 22px; background: var(--ink); color: white;
  border: none; border-radius: 100px; font-size: 13px; font-weight: 500;
  font-family: 'Geist', sans-serif; cursor: pointer; white-space: nowrap;
  transition: background 0.2s;
}

.cta-form button:hover { background: #2a3a52; }

.cta-note { font-size: 12px; color: var(--ink-50); margin-top: 12px; }

/* FOOTER */
footer {
  padding: 28px 40px; border-top: 1px solid var(--stone);
  display: flex; align-items: center; justify-content: space-between;
}

.footer-copy { font-size: 12px; color: var(--ink-50); }
.footer-links { display: flex; gap: 20px; }
.footer-links a { font-size: 12px; color: var(--ink-50); text-decoration: none; }
.footer-links a:hover { color: var(--ink); }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.reveal {
  opacity: 0; transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.visible { opacity: 1; transform: translateY(0); }

@media (max-width: 768px) {
  nav { padding: 14px 20px; }
  .nav-links { display: none; }
  .hero { padding: 100px 20px 60px; }
  h1 { font-size: 48px; }
  .steps-grid { grid-template-columns: 1fr; }
  .roi-inner { grid-template-columns: 1fr; gap: 40px; }
  .roi-stats { grid-template-columns: 1fr 1fr; }
  .testimonials-grid { grid-template-columns: 1fr; }
  .mock-app { grid-template-columns: 1fr; }
  .mock-sidebar { display: none; }
}
`,
        }}
      />

      <nav>
        <a href="#" className="nav-logo">
          <img src="/logo.svg" width={36} height={36} alt="Katch" style={{ borderRadius: 10 }} />
          <span className="logo-name">Katch</span>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#roi">Event ROI</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="nav-actions">
          <button className="btn-ghost" onClick={() => router.push("/login")}>
            Sign in
          </button>
          <button
            onClick={() => router.push("/signup")}
            style={{
              backgroundColor: "#7ab648",
              color: "white",
              border: "none",
              borderRadius: "100px",
              padding: "9px 20px",
              fontSize: "14px",
              fontFamily: "inherit",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Get started
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Conference lead capture, rewritten
        </div>
        <h1>
          Scan. Score.
          <br />
          <em>Close.</em>
        </h1>
        <p className="hero-sub">
          Turn every badge and business card into enriched contacts and AI-written follow-ups — before you leave the
          venue.
        </p>

        <form className="email-form" onSubmit={handleSubmit}>
          <input type="email" placeholder="Work email address" id="heroEmail" required />
          <button
            type="submit"
            style={{ backgroundColor: "#1a3a2a", color: "#a8d878", border: "none" }}
          >
            Get started free →
          </button>
        </form>

        {/* Mock app */}
        <div className="hero-visual">
          <div className="mock-app">
            <div className="mock-sidebar">
              <div className="mock-logo-row">
                <div className="mock-logo-icon">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2,5 L2,2 L5,2" stroke="#7ab648" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    <path d="M9,2 L12,2 L12,5" stroke="#7ab648" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    <path d="M2,9 L2,12 L5,12" stroke="#c47c4a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    <path d="M9,12 L12,12 L12,9" stroke="#c47c4a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="mock-logo-text">Katch</span>
              </div>
              <div className="mock-nav-item active">Scan</div>
              <div className="mock-nav-item">Contacts</div>
              <div className="mock-nav-item">Events</div>
              <div className="mock-nav-item">Dashboard</div>
              <div className="mock-nav-item">Sequences</div>
            </div>
            <div className="mock-main">
              <div className="mock-header">
                <div className="mock-title">Scan</div>
                <div className="mock-sub">Badge, business card, or photo</div>
              </div>
              <div className="mock-scan-area">
                <div className="scan-icon">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#1a2e1a" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <div className="mock-scan-text">Point at badge or business card</div>
              </div>
              <div className="mock-contact-card">
                <div className="mock-avatar">ML</div>
                <div>
                  <div className="mock-contact-name">Marcus Lee</div>
                  <div className="mock-contact-sub">VP Sales · Stripe · marcus@stripe.com</div>
                </div>
                <div className="mock-score">🔥 9/10</div>
              </div>
              <div className="mock-signals">
                <span className="mock-signal active">Wants a demo</span>
                <span className="mock-signal active">Active timeline</span>
                <span className="mock-signal">Budget approved</span>
                <span className="mock-signal">Referral</span>
              </div>
            </div>
          </div>

          {/* Floating cards */}
          <div className="float-card float-card-1">
            <div className="float-label">Hot leads today</div>
            <div className="float-value">28</div>
            <div className="float-sub">↑ 12 from yesterday</div>
          </div>
          <div className="float-card float-card-2">
            <div className="float-label">Sequences sent</div>
            <div className="float-value">47</div>
            <div className="float-sub">3 replies so far</div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="steps-section reveal" id="how">
        <div className="section-label">How it works</div>
        <h2>
          From badge to pipeline
          <br />
          <em>in under a minute.</em>
        </h2>
        <div className="steps-grid">
          <div className="step">
            <div className="step-num">01</div>
            <div className="step-title">Scan</div>
            <div className="step-desc">
              Point your camera at any badge or card. Claude Vision reads it in seconds.
            </div>
          </div>
          <div className="step">
            <div className="step-num">02</div>
            <div className="step-title">Extract</div>
            <div className="step-desc">
              Name, title, company, email, phone, LinkedIn — structured automatically.
            </div>
          </div>
          <div className="step">
            <div className="step-num">03</div>
            <div className="step-title">Enrich</div>
            <div className="step-desc">Apollo fills in verified contact data and firmographics instantly.</div>
          </div>
          <div className="step">
            <div className="step-num">04</div>
            <div className="step-title">Score</div>
            <div className="step-desc">
              Log buying signals. Rate 1–10. Never lose context from the conversation.
            </div>
          </div>
          <div className="step">
            <div className="step-num">05</div>
            <div className="step-title">Follow up</div>
            <div className="step-desc">
              3-email AI sequence, personalized to what you actually talked about.
            </div>
          </div>
        </div>
      </section>

      {/* EVENT ROI */}
      <section className="roi-section reveal" id="roi">
        <div className="roi-inner">
          <div>
            <div className="section-label">Event ROI</div>
            <div className="roi-title">
              Prove every
              <br />
              conference <em>pays off.</em>
            </div>
            <p className="roi-sub">Give your VP a number, not a stack of business cards.</p>
            <ul className="roi-points">
              <li>Leads collected per event, broken down by score</li>
              <li>Which shows consistently produce the hottest leads</li>
              <li>One-click CSV export for RevOps or your manager</li>
              <li>Side-by-side event comparison before you sign contracts</li>
            </ul>
          </div>
          <div className="roi-stats">
            <div className="roi-stat">
              <div className="roi-stat-num">
                74<span>→</span>
              </div>
              <div className="roi-stat-label">Avg leads per event</div>
            </div>
            <div className="roi-stat">
              <div className="roi-stat-num" style={{ color: "#c47c4a" }}>
                36%
              </div>
              <div className="roi-stat-label">Hot or Fire leads</div>
            </div>
            <div className="roi-stat">
              <div className="roi-stat-num">$2.8M</div>
              <div className="roi-stat-label">Pipeline attributed</div>
            </div>
            <div className="roi-stat">
              <div className="roi-stat-num" style={{ color: "#c47c4a" }}>
                3×
              </div>
              <div className="roi-stat-label">More follow-ups sent</div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials reveal">
        <div className="section-label">What reps say</div>
        <h2>
          Deals that would&apos;ve
          <br />
          <em>slipped through.</em>
        </h2>
        <div className="testimonials-grid">
          <div className="testimonial">
            <div className="testimonial-quote">
              &quot;Scanned 47 contacts at SaaStr. Had sequences queued before I left the venue. Closed two from that
              trip.&quot;
            </div>
            <div className="testimonial-author">
              <div className="t-avatar">MR</div>
              <div>
                <div className="t-name">Michael R.</div>
                <div className="t-role">AE · Series B SaaS</div>
              </div>
            </div>
          </div>
          <div className="testimonial">
            <div className="testimonial-quote">
              &quot;The conversation signals feature is genius. I finally stopped forgetting who said what at every
              conference.&quot;
            </div>
            <div className="testimonial-author">
              <div className="t-avatar c">JL</div>
              <div>
                <div className="t-name">Jamie L.</div>
                <div className="t-role">VP Sales · Fintech</div>
              </div>
            </div>
          </div>
          <div className="testimonial">
            <div className="testimonial-quote">
              &quot;We went from 20% follow-up rate to over 90%. Our entire team uses it at every trade show
              now.&quot;
            </div>
            <div className="testimonial-author">
              <div className="t-avatar g">SC</div>
              <div>
                <div className="t-name">Sarah C.</div>
                <div className="t-role">Director of Sales · Enterprise</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section reveal" id="pricing">
        <div className="cta-title">
          Your next deal starts
          <br />
          with a <em>scan.</em>
        </div>
        <p className="cta-sub">Free to start. No credit card required.</p>
        <form className="cta-form" onSubmit={handleSubmit}>
          <input type="email" placeholder="Work email address" required />
          <button
            type="submit"
            style={{ backgroundColor: "#1a3a2a", color: "#a8d878" }}
          >
            Get started free
          </button>
        </form>
        <p className="cta-note">
          Already have an account?{" "}
          <a href="/login" style={{ color: "var(--ink)", textDecoration: "underline" }}>
            Sign in
          </a>
        </p>
      </section>

      <footer>
        <div className="footer-copy">© 2026 Katch. All rights reserved.</div>
        <div className="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="mailto:hello@katch.app">Contact</a>
        </div>
      </footer>
    </div>
  );
}

