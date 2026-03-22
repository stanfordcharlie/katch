'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
  const router = useRouter();

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll<HTMLElement>('.reveal');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
      <style>{`html, body { background: #0a0a0a !important; }`}</style>
      <style
        dangerouslySetInnerHTML={{
          __html: `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

 body {
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
  color: #0a0a0a;
  cursor: pointer;
  font-weight: 500;
  transition: transform 0.1s ease, box-shadow 0.2s ease, background 0.2s ease;
  box-shadow: 0 14px 40px rgba(125,222,60,0.35);
}
.btn-solid:hover {
  background: #90f04d;
  transform: translateY(-1px);
  box-shadow: 0 18px 55px rgba(125,222,60,0.5);
}

/* PAGE */
.pricing-page {
  padding: 120px 40px 80px;
}

.pricing-header {
  max-width: 720px;
  margin: 120px auto 48px;
}

.pricing-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(125,222,60,0.5);
  background: rgba(10,10,10,0.8);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #7dde3c;
  margin-bottom: 16px;
}

.pricing-title {
  margin-bottom: 12px;
}

.toggle-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 24px;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(10,10,10,0.8);
}

.toggle-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}

.toggle-pill.active {
  background: #ffffff;
  color: #0a0a0a;
}

.toggle-pill.inactive {
  color: rgba(255,255,255,0.85);
}

.toggle-badge {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(125,222,60,0.18);
  color: #7dde3c;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
  margin-top: 40px;
}

.pricing-card {
  background: #111111;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 24px 22px 26px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.pricing-card.team {
  border: 1.5px solid #7dde3c;
}

.pricing-plan-name {
  margin-bottom: 8px;
}

.pricing-price {
  margin-bottom: 4px;
}

.pricing-meta {
  margin-bottom: 16px;
}

.badge-most-popular {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(125,222,60,0.16);
  color: #7dde3c;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  margin-bottom: 10px;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 12px 0 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #ffffff;
}

.feature-item-muted {
  color: rgba(255,255,255,0.4);
}

.feature-icon {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-icon.check {
  background: rgba(125,222,60,0.18);
  color: #7dde3c;
}

.feature-icon.cross {
  background: transparent;
  color: rgba(255,255,255,0.3);
}

.pricing-cta {
  margin-top: 4px;
}

.pricing-cta button {
  width: 100%;
  padding: 9px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.4);
  background: transparent;
  color: #ffffff;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.pricing-cta button.solid {
  background: #7dde3c;
  color: #ffffff;
  border-color: #7dde3c;
}

.pricing-cta button.outline-green {
  border-color: #7dde3c;
  color: #7dde3c;
}

.pricing-cta button:hover {
  background: rgba(255,255,255,0.06);
}

.pricing-cta button.solid:hover {
  background: #90f04d;
}

.pricing-cta button.outline-green:hover {
  background: rgba(125,222,60,0.18);
}

@media (max-width: 1024px) {
  .pricing-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  nav.landing2-nav { width: calc(100% - 32px); padding: 8px 14px; }
  .nav-links { display: none; }
  .pricing-page { padding: 120px 20px 60px; }
  .pricing-header { margin: 110px auto 40px; }
  .pricing-grid { grid-template-columns: 1fr; }
}
`,
        }}
      />

      <nav className='landing2-nav'>
        <a href='/' className='nav-logo'>
          <img src='/logo.svg' width={36} height={36} alt='Katch' style={{ borderRadius: 10 }} />
          <span className='logo-name'>Katch</span>
        </a>
        <div className='nav-links'>
          <a href='/landing2'>Product</a>
          <a href='/pricing'>Pricing</a>
        </div>
        <div className='nav-actions'>
          <button className='btn-ghost' onClick={() => router.push('/login')}>
            Sign in
          </button>
          <button className='btn-solid' onClick={() => router.push('/signup')}>
            Get started
          </button>
        </div>
      </nav>

      <main className='pricing-page'>
        <header className='pricing-header reveal'>
          <div className='pricing-eyebrow'>PRICING</div>
          <h1
            className='pricing-title'
            style={{
              fontSize: '24px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: '#ffffff',
            }}
          >
            Simple pricing. No surprises.
          </h1>
          <p
            className='pricing-subtitle'
            style={{
              fontSize: '15px',
              fontWeight: 400,
              lineHeight: 1.5,
              color: '#999',
            }}
          >
            Start free, scale when you&apos;re ready. Cancel anytime.
          </p>
          <div className='toggle-row'>
            <div className='toggle-pill active'>
              <span>Monthly</span>
            </div>
            <div className='toggle-pill inactive'>
              <span>Annual</span>
            </div>
            <div className='toggle-badge'>Save 20%</div>
          </div>
        </header>

        <section className='pricing-grid reveal'>
          {/* Free */}
          <article className='pricing-card'>
            <div>
              <div
                className='pricing-plan-name'
                style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em' }}
              >
                Free
              </div>
              <div
                className='pricing-price'
                style={{
                  fontSize: '38px',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                  color: '#ffffff',
                }}
              >
                $0
              </div>
              <div
                className='pricing-meta'
                style={{ fontSize: '14px', fontWeight: 400, color: '#999' }}
              >
                Forever
              </div>
              <ul className='feature-list'>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    10 scans per month
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Basic contact export (CSV)
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    1 event
                  </span>
                </li>
                <li className='feature-item feature-item-muted'>
                  <span className='feature-icon cross'>✕</span>
                  <span
                    style={{
                      color: 'rgba(255,255,255,0.35)',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    AI email sequences
                  </span>
                </li>
                <li className='feature-item feature-item-muted'>
                  <span className='feature-icon cross'>✕</span>
                  <span
                    style={{
                      color: 'rgba(255,255,255,0.35)',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Lead scoring 1–10
                  </span>
                </li>
                <li className='feature-item feature-item-muted'>
                  <span className='feature-icon cross'>✕</span>
                  <span
                    style={{
                      color: 'rgba(255,255,255,0.35)',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    HubSpot import
                  </span>
                </li>
              </ul>
            </div>
            <div className='pricing-cta'>
              <button
                style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.01em' }}
              >
                Get started free
              </button>
            </div>
          </article>

          {/* Solo */}
          <article className='pricing-card'>
            <div>
              <div
                className='pricing-plan-name'
                style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em' }}
              >
                Solo
              </div>
              <div
                className='pricing-price'
                style={{
                  fontSize: '38px',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                  color: '#ffffff',
                }}
              >
                $29
              </div>
              <div
                className='pricing-meta'
                style={{ fontSize: '14px', fontWeight: 400, color: '#999' }}
              >
                Per month
              </div>
              <ul className='feature-list'>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Unlimited scans
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    AI email sequences
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Lead scoring 1–10
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Unlimited events
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    HubSpot CSV export
                  </span>
                </li>
                <li className='feature-item feature-item-muted'>
                  <span className='feature-icon cross'>✕</span>
                  <span
                    style={{
                      color: 'rgba(255,255,255,0.35)',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Team collaboration
                  </span>
                </li>
              </ul>
            </div>
            <div className='pricing-cta'>
              <button
                style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.01em' }}
              >
                Start free trial
              </button>
            </div>
          </article>

          {/* Team - Most popular */}
          <article className='pricing-card team'>
            <div>
              <div className='badge-most-popular'>Most popular</div>
              <div
                className='pricing-plan-name'
                style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em' }}
              >
                Team
              </div>
              <div
                className='pricing-price'
                style={{
                  fontSize: '38px',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                  color: '#ffffff',
                }}
              >
                $79
              </div>
              <div
                className='pricing-meta'
                style={{ fontSize: '14px', fontWeight: 400, color: '#999' }}
              >
                Per month · up to 5 users
              </div>
              <ul className='feature-list'>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Everything in Solo
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Up to 5 seats
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Shared contact pool
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Team dashboard & analytics
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Attendee list analysis
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Priority support
                  </span>
                </li>
              </ul>
            </div>
            <div className='pricing-cta'>
              <button
                className='solid'
                style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.01em' }}
              >
                Start free trial
              </button>
            </div>
          </article>

          {/* Enterprise */}
          <article className='pricing-card'>
            <div>
              <div
                className='pricing-plan-name'
                style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em' }}
              >
                Enterprise
              </div>
              <div
                className='pricing-price'
                style={{
                  fontSize: '38px',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                  color: '#ffffff',
                }}
              >
                Custom
              </div>
              <div
                className='pricing-meta'
                style={{ fontSize: '14px', fontWeight: 400, color: '#999' }}
              >
                Talk to sales
              </div>
              <ul className='feature-list'>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Everything in Team
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Unlimited seats
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    CRM integrations (Salesforce, HubSpot)
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    SSO & admin controls
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Dedicated CSM
                  </span>
                </li>
                <li className='feature-item'>
                  <span className='feature-icon check'>✓</span>
                  <span
                    style={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    Custom onboarding
                  </span>
                </li>
              </ul>
            </div>
            <div className='pricing-cta'>
              <button
                className='outline-green'
                style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.01em' }}
              >
                Talk to sales
              </button>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

