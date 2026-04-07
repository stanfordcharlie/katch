'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function LandingPage() {
  const [billing, setBilling] = useState<'monthly' | 'annually'>('monthly')
  const [mobileMenu, setMobileMenu] = useState(false)

  const plans = [
    {
      name: 'Starter',
      price: { monthly: 0, annually: 0 },
      description: 'For individuals trying out Katch.',
      cta: 'Get started free',
      ctaHref: '/login',
      featured: false,
      features: [
        '50 badge scans / month',
        'Basic ICP scoring',
        '1 event',
        'CSV export',
        'HubSpot sync (25 contacts)',
      ],
    },
    {
      name: 'Pro',
      price: { monthly: 29, annually: 23 },
      description: 'For sales reps who live at conferences.',
      cta: 'Start free trial',
      ctaHref: '/login',
      featured: true,
      features: [
        'Unlimited badge scans',
        'AI lead scoring + enrichment',
        'Unlimited events',
        'HubSpot + Salesforce sync',
        'Email sequence generator',
        'Lead list upload + scoring',
        'Priority support',
      ],
    },
    {
      name: 'Team',
      price: { monthly: 79, annually: 63 },
      description: 'For revenue teams attending multiple events.',
      cta: 'Talk to us',
      ctaHref: 'mailto:hello@katch.app',
      featured: false,
      features: [
        'Everything in Pro',
        'Up to 10 seats',
        'Team shared contact pool',
        'Rep-level analytics',
        'Custom ICP per rep',
        'Dedicated onboarding',
      ],
    },
  ]

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: '#fff', color: '#0a0a0a', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; color: inherit; }
        .nav-link { font-size: 15px; color: #555; transition: color 0.15s; }
        .nav-link:hover { color: #0a0a0a; }
        .hero-word { display: inline-block; }
        .feature-card { background: #f9f9f7; border-radius: 16px; padding: 32px; transition: background 0.2s; }
        .feature-card:hover { background: #f3f3ef; }
        .plan-card { border: 1px solid #e8e8e4; border-radius: 20px; padding: 36px; transition: transform 0.2s, box-shadow 0.2s; }
        .plan-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.06); }
        .plan-card.featured { border: 2px solid #0a0a0a; background: #0a0a0a; color: #fff; }
        .cta-primary { background: #0a0a0a; color: #fff; border: none; border-radius: 100px; padding: 14px 28px; font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; transition: opacity 0.15s; display: inline-block; }
        .cta-primary:hover { opacity: 0.85; }
        .cta-secondary { background: transparent; color: #0a0a0a; border: 1px solid #d0d0cc; border-radius: 100px; padding: 14px 28px; font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background 0.15s; display: inline-block; }
        .cta-secondary:hover { background: #f5f5f1; }
        .cta-featured { background: #7dde3c; color: #1a3a2a; border: none; border-radius: 100px; padding: 14px 28px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity 0.15s; display: inline-block; width: 100%; text-align: center; }
        .cta-featured:hover { opacity: 0.9; }
        .cta-plan { background: transparent; color: #0a0a0a; border: 1px solid #e0e0dc; border-radius: 100px; padding: 14px 28px; font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background 0.15s; display: inline-block; width: 100%; text-align: center; }
        .cta-plan:hover { background: #f5f5f1; }
        .cta-plan.dark { color: #fff; border-color: rgba(255,255,255,0.2); }
        .cta-plan.dark:hover { background: rgba(255,255,255,0.08); }
        .billing-toggle { display: flex; align-items: center; background: #f3f3ef; border-radius: 100px; padding: 4px; gap: 2px; }
        .billing-opt { padding: 8px 20px; border-radius: 100px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; color: #888; }
        .billing-opt.active { background: #fff; color: #0a0a0a; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .check { color: #7dde3c; font-weight: 600; margin-right: 10px; }
        .check-dark { color: #a8f060; font-weight: 600; margin-right: 10px; }
        .badge { display: inline-block; background: #f0fae6; color: #2d6a1f; border-radius: 100px; padding: 4px 12px; font-size: 13px; font-weight: 500; }
        .step-num { width: 36px; height: 36px; border-radius: 50%; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; flex-shrink: 0; }
        .faq-item { border-bottom: 1px solid #e8e8e4; padding: 24px 0; }
        .pill-tag { display: inline-block; background: #f3f3ef; border-radius: 100px; padding: 6px 14px; font-size: 13px; color: #555; margin: 4px; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #f0f0ec', padding: '0 32px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: '#0a0a0a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" fill="white"/><rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.5"/><rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.5"/><rect x="8" y="8" width="5" height="5" rx="1" fill="#7dde3c"/></svg>
            </div>
            <span style={{ fontWeight: 600, fontSize: 16 }}>Katch</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <a href="#how-it-works" className="nav-link">How it works</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#pricing" className="nav-link">Pricing</a>
          </div>
          <Link href="/login" className="cta-primary" style={{ padding: '10px 22px', fontSize: 14 }}>Go to app</Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '120px 32px 80px',
          textAlign: 'center',
          position: 'relative',
          backgroundImage: "url('/landing-cartoon.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(1px)',
            zIndex: 0,
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: 20 }}>
            <span className="badge">Now with HubSpot + Salesforce sync</span>
          </div>
          <h1 style={{ fontSize: 'clamp(52px, 8vw, 88px)', fontWeight: 300, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 28 }}>
            Scan it. Score it.<br />
            <span style={{ fontStyle: 'italic', color: '#7dde3c' }}>Close it.</span>
          </h1>
          <p style={{ fontSize: 20, color: '#666', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.6, fontWeight: 400 }}>
            The AI-powered lead capture platform for in-person events. Stop forgetting leads. Start closing deals.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="cta-primary" style={{ fontSize: 16, padding: '16px 32px' }}>Get started free</Link>
            <a href="#how-it-works" className="cta-secondary" style={{ fontSize: 16, padding: '16px 32px' }}>See how it works</a>
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: '#999' }}>Free to start. No credit card required.</p>
        </div>
      </section>

      {/* Logos */}
      <section style={{ borderTop: '1px solid #f0f0ec', borderBottom: '1px solid #f0f0ec', padding: '28px 32px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#999', marginBottom: 20, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Trusted by teams at</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap', alignItems: 'center' }}>
            {['Rec Technologies', 'Denver Parks', 'Active Network', 'YMCA', 'Vermont Systems'].map(c => (
              <span key={c} style={{ fontSize: 15, fontWeight: 500, color: '#bbb', letterSpacing: '-0.01em' }}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ maxWidth: 1080, margin: '0 auto', padding: '100px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <p style={{ fontSize: 13, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>How it works</p>
          <h2 style={{ fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1.1 }}>From badge to CRM<br />in three steps.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {[
            { n: '1', title: 'Scan', body: 'Point your phone at any badge or business card. Claude Vision reads it instantly — no QR codes, no manual typing.' },
            { n: '2', title: 'Score', body: 'Every contact is scored against your ICP in seconds. Talking points, red flags, and fit reason generated automatically.' },
            { n: '3', title: 'Hand off', body: 'Push to HubSpot or Salesforce with one tap. Contacts arrive with scores, notes, and AI insights attached.' },
          ].map(s => (
            <div key={s.n} style={{ padding: '40px 36px', background: '#f9f9f7', borderRadius: 20 }}>
              <div className="step-num" style={{ marginBottom: 24 }}>{s.n}</div>
              <h3 style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', marginBottom: 12 }}>{s.title}</h3>
              <p style={{ fontSize: 16, color: '#666', lineHeight: 1.65 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ background: '#f9f9f7', padding: '100px 32px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <p style={{ fontSize: 13, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Features</p>
            <h2 style={{ fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Everything you need<br />at a conference.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {[
              { icon: '⬡', title: 'AI badge scanning', body: 'Claude Vision reads badges and business cards instantly. Works on crumpled cards, dim lighting, any format.' },
              { icon: '◈', title: 'ICP lead scoring', body: 'Every contact scored against your custom ICP profile. Know who to follow up with before you leave the floor.' },
              { icon: '◎', title: 'Smart enrichment', body: 'Talking points, red flags, and ICP fit reasons generated automatically for every contact you meet.' },
              { icon: '⟳', title: 'CRM sync', body: 'Push to HubSpot or Salesforce in one click. Contacts arrive with scores, notes, and AI insights included.' },
              { icon: '≡', title: 'Lead list upload', body: 'Upload pre or post-conference attendee lists. Katch scores every contact and flags who to prioritize.' },
              { icon: '✉', title: 'Sequence generator', body: 'Generate personalized follow-up email sequences for each contact based on your conversation signals.' },
            ].map(f => (
              <div key={f.title} className="feature-card">
                <div style={{ fontSize: 24, marginBottom: 16, opacity: 0.4 }}>{f.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 15, color: '#666', lineHeight: 1.65 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ maxWidth: 1080, margin: '0 auto', padding: '100px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontSize: 13, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Pricing</p>
          <h2 style={{ fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 300, letterSpacing: '-0.02em', marginBottom: 32 }}>Start for free.</h2>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="billing-toggle">
              <div className={`billing-opt ${billing === 'monthly' ? 'active' : ''}`} onClick={() => setBilling('monthly')}>Monthly</div>
              <div className={`billing-opt ${billing === 'annually' ? 'active' : ''}`} onClick={() => setBilling('annually')}>
                Annually
                {billing === 'annually' && <span style={{ marginLeft: 6, background: '#f0fae6', color: '#2d6a1f', borderRadius: 100, padding: '1px 8px', fontSize: 11, fontWeight: 600 }}>-20%</span>}
                {billing === 'monthly' && <span style={{ marginLeft: 6, color: '#7dde3c', fontSize: 11, fontWeight: 600 }}>Save 20%</span>}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
          {plans.map(p => (
            <div key={p.name} className={`plan-card ${p.featured ? 'featured' : ''}`}>
              <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: p.featured ? 'rgba(255,255,255,0.5)' : '#999', marginBottom: 12 }}>{p.name}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 48, fontWeight: 300, letterSpacing: '-0.03em' }}>
                  {p.price[billing] === 0 ? 'Free' : `$${p.price[billing]}`}
                </span>
                {p.price[billing] > 0 && <span style={{ fontSize: 14, color: p.featured ? 'rgba(255,255,255,0.5)' : '#999' }}>/mo</span>}
              </div>
              <p style={{ fontSize: 14, color: p.featured ? 'rgba(255,255,255,0.6)' : '#888', marginBottom: 28, lineHeight: 1.5 }}>{p.description}</p>
              <Link href={p.ctaHref} className={p.featured ? 'cta-featured' : 'cta-plan'} style={!p.featured ? {} : {}}>{p.cta}</Link>
              <div style={{ borderTop: `1px solid ${p.featured ? 'rgba(255,255,255,0.1)' : '#f0f0ec'}`, marginTop: 28, paddingTop: 24 }}>
                {p.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 12, fontSize: 14, color: p.featured ? 'rgba(255,255,255,0.85)' : '#444' }}>
                    <span className={p.featured ? 'check-dark' : 'check'}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section style={{ background: '#0a0a0a', margin: '0 32px 80px', borderRadius: 24, padding: '72px 48px', textAlign: 'center', maxWidth: 1016, marginLeft: 'auto', marginRight: 'auto' }}>
        <h2 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, color: '#fff', letterSpacing: '-0.02em', marginBottom: 16 }}>Never lose a conference<br />lead again.</h2>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', marginBottom: 36 }}>Join sales reps who use Katch to capture, score, and close.</p>
        <Link href="/login" style={{ background: '#7dde3c', color: '#1a3a2a', borderRadius: 100, padding: '16px 36px', fontSize: 16, fontWeight: 600, display: 'inline-block' }}>Get started free</Link>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #f0f0ec', padding: '40px 32px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, background: '#0a0a0a', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" fill="white"/><rect x="8" y="8" width="5" height="5" rx="1" fill="#7dde3c"/></svg>
            </div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Katch</span>
          </div>
          <p style={{ fontSize: 13, color: '#bbb' }}>© 2026 Katch. All rights reserved.</p>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="#" style={{ fontSize: 13, color: '#bbb' }}>Privacy</a>
            <a href="#" style={{ fontSize: 13, color: '#bbb' }}>Terms</a>
            <a href="mailto:hello@katch.app" style={{ fontSize: 13, color: '#bbb' }}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
