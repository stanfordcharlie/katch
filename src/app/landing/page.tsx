'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingPageV2() {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.querySelector('input[type=email]') as HTMLInputElement | null;
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
    <div style={{ backgroundColor: "#0a0a0a" }}>
      <style>{`html, body { background: #0a0a0a !important; }`}</style>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,800;1,600;1,800&family=Geist:wght@300;400;500&display=swap"
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Geist', system-ui, sans-serif;
  background: #0a0a0a;
  color: #ffffff;
  overflow-x: hidden;
}

/* NAV */
nav.landing2-nav {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 80px);
  max-width: 1100px;
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 999px;
  padding: 10px 20px;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: #ffffff;
}

.logo-name {
  font-family: 'Syne', sans-serif;
  font-size: 22px;
  letter-spacing: -0.04em;
  color: #ffffff;
}

.nav-links { display: flex; gap: 24px; }
.nav-links a {
  font-size: 15px;
  color: #ffffff;
  text-decoration: none;
  transition: color 0.2s ease;
}
.nav-links a:hover { color: #ffffff; }

.nav-actions { display: flex; align-items: center; gap: 10px; }

.btn-ghost {
  font-size: 14px; padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.14);
  background: transparent;
  color: rgba(255,255,255,0.72);
  cursor: pointer;
  font-family: 'Geist', sans-serif;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.btn-ghost:hover {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.28);
  color: #ffffff;
}

.btn-solid {
  font-size: 14px; padding: 9px 20px;
  border-radius: 999px;
  border: none;
  background: #7dde3c;
  color: #0a1a0a;
  cursor: pointer;
  font-family: 'Geist', sans-serif;
  font-weight: 500;
  transition: transform 0.1s ease, box-shadow 0.2s ease, background 0.2s ease;
  box-shadow: 0 14px 40px rgba(125,222,60,0.35);
}
.btn-solid:hover {
  background: #90f04d;
  transform: translateY(-1px);
  box-shadow: 0 18px 55px rgba(125,222,60,0.5);
}

/* HERO */
.hero2 {
  position: relative;
  min-height: 100vh;
  padding: 120px 40px 80px 80px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
  overflow: hidden;
  color: #ffffff;
}

.hero2-bg {
  position: absolute;
  inset: 0;
  background-image: url('/images/crowd.jpg');
  background-size: cover;
  background-position: center top;
  filter: grayscale(100%);
  opacity: 0.9;
}

.hero2-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top, rgba(0,0,0,0.2), rgba(0,0,0,0.65));
}

.hero2-inner {
  position: relative;
  max-width: 650px;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.hero2-title {
  font-family: 'Syne', sans-serif;
  
  font-weight: 800;
  font-size: clamp(52px, 9vw, 96px);
  line-height: 1.0;
  letter-spacing: -3px;
  color: #ffffff;
  text-shadow: 0 0 40px rgba(0,0,0,0.6);
  margin-bottom: 20px;
}

.hero2-title span {
  display: block;
}

.hero2-sub {
  font-size: 20px;
  font-weight: 400;
  color: #ffffff;
  margin-bottom: 32px;
}

.hero2-form {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 32px;
}

.hero2-footnote {
  font-size: 11px;
  color: #ffffff;
  margin-top: 14px;
}

/* SECTIONS */
.section-shell {
  padding: 80px 40px;
  background: #0d0d0d;
}

.section-shell.alt {
  background: #111111;
}

.section-inner {
  max-width: 1100px;
  margin: 0 auto;
}

.section-label {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #ffffff;
  font-weight: 500;
  margin-bottom: 18px;
}

h2.section-title {
  font-family: 'Syne', sans-serif;
  font-size: clamp(32px, 4vw, 48px);
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: #ffffff;
  margin-bottom: 40px;
}

h2.section-title em {
  
  color: #ffffff;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1px;
  background: #181818;
  border-radius: 18px;
  overflow: hidden;
}

.step {
  background: #0f0f0f;
  padding: 28px 22px;
}

.step-num {
  font-family: 'Syne', sans-serif;
  font-size: 32px;
  color: rgba(255,255,255,0.12);
  margin-bottom: 14px;
}

.step-title {
  font-size: 15px;
  font-weight: 500;
  color: #ffffff;
  margin-bottom: 8px;
}

.step-desc {
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255,255,255,0.6);
}

/* ROI */
.roi-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 64px;
  align-items: center;
}

.roi-sub {
  font-size: 15px;
  line-height: 1.7;
  color: #ffffff;
  margin-bottom: 24px;
}

.roi-points {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 14px;
  color: #ffffff;
}

.roi-points li::before {
  content: '→';
  margin-right: 8px;
  color: rgba(255,255,255,0.8);
}

.roi-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.roi-stat {
  background: #0f0f0f;
  border-radius: 16px;
  padding: 22px;
  border: 1px solid rgba(255,255,255,0.08);
}

.roi-stat-num {
  font-family: 'Syne', sans-serif;
  font-size: 36px;
  color: #ffffff;
  margin-bottom: 6px;
}

.roi-stat-num span {
  color: #ffffff;
}

.roi-stat-label {
  font-size: 12px;
  color: #ffffff;
}

/* TESTIMONIALS */
.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  margin-top: 40px;
}

.testimonial {
  background: #101010;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  padding: 26px;
}

.testimonial-quote {
  font-family: 'Syne', sans-serif;
  
  font-size: 16px;
  line-height: 1.7;
  color: #ffffff;
  margin-bottom: 22px;
}

.testimonial-author {
  display: flex;
  align-items: center;
  gap: 10px;
}

.t-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  font-size: 12px;
  font-weight: 500;
  font-family: 'Geist', sans-serif;
  background: #7dde3c;
  color: #0a1a0a;
}

.t-name {
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
}

.t-role {
  font-size: 11px;
  color: rgba(255,255,255,0.6);
  margin-top: 1px;
}

/* CTA */
.cta-section {
  padding: 90px 40px 80px;
  text-align: left;
  background: #0d0d0d;
}

.cta-title {
  font-family: 'Syne', sans-serif;
  font-size: clamp(40px, 5vw, 64px);
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: #ffffff;
  margin-bottom: 18px;
}

.cta-title em {
  
  color: #ffffff;
}

.cta-sub {
  font-size: 15px;
  color: rgba(255,255,255,0.6);
  margin-bottom: 32px;
}

.cta-form {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  max-width: 440px;
  margin: 0 auto;
  padding: 6px 6px 6px 20px;
  border-radius: 999px;
  background: #050505;
  border: 1px solid rgba(255,255,255,0.16);
  box-shadow: 0 18px 60px rgba(0,0,0,0.9);
}

.cta-form input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  font-family: 'Geist', sans-serif;
  color: #ffffff;
}

.cta-form input::placeholder {
  color: rgba(255,255,255,0.5);
}

.cta-form button {
  border-radius: 999px;
}

.cta-note {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  margin-top: 12px;
}

.cta-note a {
  color: #ffffff;
  text-decoration: underline;
}

/* FOOTER */
footer {
  padding: 26px 40px;
  border-top: 1px solid rgba(255,255,255,0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #050505;
}

.footer-copy {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
}

.footer-links {
  display: flex;
  gap: 20px;
}

.footer-links a {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  text-decoration: none;
}

.footer-links a:hover {
  color: #ffffff;
}

/* Reveal animation */
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

@media (max-width: 768px) {
  nav.landing2-nav { padding: 14px 20px; }
  .nav-links { display: none; }
  .hero2 { padding: 110px 18px 60px; }
  .hero2-title { font-size: 52px; letter-spacing: -2px; }
  .section-shell, .cta-section { padding: 64px 20px; }
  .roi-grid { grid-template-columns: 1fr; gap: 40px; }
  .roi-stats { grid-template-columns: 1fr 1fr; }
  .steps-grid { grid-template-columns: 1fr; }
  .testimonials-grid { grid-template-columns: 1fr; }
}
`,
        }}
      />

      <nav className="landing2-nav">
        <a href="#" className="nav-logo">
          <img src="/logo.svg" width={36} height={36} alt="Katch" style={{ borderRadius: 10 }} />
          <span className="logo-name">Katch</span>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#roi">Event ROI</a>
          <a href="/pricing">Pricing</a>
        </div>
        <div className="nav-actions">
          <button className="btn-ghost" onClick={() => router.push("/login")}>
            Sign in
          </button>
          <button className="btn-solid" onClick={() => router.push("/signup")}>
            Get started
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero2">
        <div className="hero2-bg" />
        <div className="hero2-overlay" />
        <div
          className="hero2-inner"
          style={{
            textAlign: "left",
            alignItems: "flex-start",
            paddingLeft: "80px",
            paddingBottom: "100px",
            maxWidth: "750px",
          }}
        >
          <h1
            className="hero2-title"
            style={{
              color: "#7dde3c",
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: "clamp(40px, 6vw, 72px)",
              lineHeight: 1.0,
              letterSpacing: "-3px",
              marginBottom: "20px",
            }}
          >
            <span
              style={{
                color: "#ffffff",
                WebkitTextFillColor: "#ffffff",
                display: "block",
              }}
            >
              The room is full.
            </span>
            <span
              style={{
                color: "#ffffff",
                WebkitTextFillColor: "#ffffff",
                display: "block",
              }}
            >
              Your pipeline
            </span>
            <span
              style={{
                color: "#ffffff",
                WebkitTextFillColor: "#ffffff",
                display: "block",
              }}
            >
              shouldn&apos;t be empty.
            </span>
          </h1>
          <p className="hero2-sub" style={{ textAlign: "left" }}>
            Scan badges. Score leads. Close more.
          </p>
          <form
            className="hero2-form"
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              justifyContent: "flex-start",
            }}
          >
            <input
              type="email"
              placeholder="Work email address"
              required
              style={{
                height: "48px",
                width: "280px",
                borderRadius: "8px",
                border: "none",
                background: "#ffffff",
                color: "#0a0a0a",
                padding: "0 16px",
                fontSize: "15px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                height: "48px",
                padding: "0 24px",
                background: "#7dde3c",
                color: "#0a1a0a",
                border: "none",
                borderRadius: "8px",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Get started free →
            </button>
          </form>
          <div className="hero2-footnote" style={{ textAlign: "left" }}>
            Free to start. No credit card required.
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section-shell reveal" id="how">
        <div className="section-inner">
          <div className="section-label">How it works</div>
          <h2 className="section-title">
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
              <div className="step-desc">
                Apollo fills in verified contact data and firmographics instantly.
              </div>
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
        </div>
      </section>

      {/* EVENT ROI */}
      <section className="section-shell alt reveal" id="roi">
        <div className="section-inner">
          <div className="roi-grid">
            <div>
              <div className="section-label">Event ROI</div>
              <h2 className="section-title">
                Prove every
                <br />
                conference <em>pays off.</em>
              </h2>
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
                <div className="roi-stat-num">
                  36%
                </div>
                <div className="roi-stat-label">Hot or Fire leads</div>
              </div>
              <div className="roi-stat">
                <div className="roi-stat-num">$2.8M</div>
                <div className="roi-stat-label">Pipeline attributed</div>
              </div>
              <div className="roi-stat">
                <div className="roi-stat-num">
                  3×
                </div>
                <div className="roi-stat-label">More follow-ups sent</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section-shell reveal">
        <div className="section-inner">
          <div className="section-label">What reps say</div>
          <h2 className="section-title">
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
                <div className="t-avatar">JL</div>
                <div>
                  <div className="t-name">Jamie L.</div>
                  <div className="t-role">VP Sales · Fintech</div>
                </div>
              </div>
            </div>
            <div className="testimonial">
              <div className="testimonial-quote">
                &quot;We went from 20% follow-up rate to over 90%. Our entire team uses it at every trade show now.&quot;
              </div>
              <div className="testimonial-author">
                <div className="t-avatar">SC</div>
                <div>
                  <div className="t-name">Sarah C.</div>
                  <div className="t-role">Director of Sales · Enterprise</div>
                </div>
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
          <button type="submit" className="btn-solid">
            Get started free
          </button>
        </form>
        <p className="cta-note">
          Already have an account?{" "}
          <a href="/login">Sign in</a>
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

