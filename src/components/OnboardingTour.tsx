import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const STEPS = [
  {
    id: 'scan',
    target: '[data-tour="scan"]',
    title: 'Scan a badge',
    description:
      'Capture a contact instantly by scanning their conference badge or business card with your camera.',
    position: 'right',
  },
  {
    id: 'contacts',
    target: '[data-tour="contacts"]',
    title: 'Your contacts',
    description: 'Every scanned contact lives here, scored and ready to follow up.',
    position: 'right',
  },
  {
    id: 'events',
    target: '[data-tour="events"]',
    title: 'Organize by event',
    description: 'Tag contacts to events so you always know where you met them.',
    position: 'right',
  },
  {
    id: 'sequences',
    target: '[data-tour="sequences"]',
    title: 'AI follow-up sequences',
    description:
      'Generate personalized email sequences for your contacts in one click.',
    position: 'right',
  },
  {
    id: 'settings',
    target: '[data-tour="settings"]',
    title: 'Set your preferences',
    description:
      'Configure your conversation signals, email tone, and HubSpot integration.',
    position: 'right',
  },
]

export default function OnboardingTour({
  onComplete,
}: {
  onComplete: () => void
}) {
  const [step, setStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const currentStep = STEPS[step]

  useEffect(() => {
    const el = document.querySelector(currentStep.target)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [step, currentStep.target])

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      handleComplete()
    }
  }

  const handleComplete = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            onboarding_completed: true,
          },
          { onConflict: 'user_id' }
        )
    }
    onComplete()
  }

  if (!targetRect) return null

  const PADDING = 8
  const spotlight = {
    top: targetRect.top - PADDING,
    left: targetRect.left - PADDING,
    width: targetRect.width + PADDING * 2,
    height: targetRect.height + PADDING * 2,
  }

  const tooltipLeft =
    currentStep.position === 'right' ? targetRect.right + 16 : targetRect.left
  const tooltipTop = targetRect.top + targetRect.height / 2 - 80

  return (
    <>
      {/* Dark overlay with spotlight cutout */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'none',
        }}
      >
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx="10"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.65)"
            mask="url(#spotlight-mask)"
          />
          {/* Green border around spotlight */}
          <rect
            x={spotlight.left}
            y={spotlight.top}
            width={spotlight.width}
            height={spotlight.height}
            rx="10"
            fill="none"
            stroke="#7dde3c"
            strokeWidth="2"
          />
        </svg>
      </div>

      {/* Tooltip */}
      <div
        style={{
          position: 'fixed',
          left: Math.min(tooltipLeft, window.innerWidth - 280),
          top: Math.max(12, tooltipTop),
          zIndex: 9999,
          background: '#ffffff',
          borderRadius: '16px',
          padding: '20px',
          width: '240px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
          border: '1px solid #ebebeb',
        }}
      >
        {/* Step counter */}
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#999',
            marginBottom: '6px',
          }}
        >
          Step {step + 1} of {STEPS.length}
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? '16px' : '6px',
                height: '6px',
                borderRadius: '999px',
                background: i <= step ? '#7dde3c' : '#e8e8e8',
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>

        <div
          style={{
            fontSize: '15px',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: '#111',
            marginBottom: '6px',
          }}
        >
          {currentStep.title}
        </div>
        <div
          style={{
            fontSize: '13px',
            color: '#666',
            lineHeight: 1.5,
            marginBottom: '16px',
          }}
        >
          {currentStep.description}
        </div>

        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <button
            onClick={handleComplete}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '13px',
              color: '#999',
              cursor: 'pointer',
              padding: '0',
            }}
          >
            Skip tour
          </button>
          <button
            onClick={handleNext}
            style={{
              background: '#7dde3c',
              color: '#0a1a0a',
              border: 'none',
              borderRadius: '999px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {step < STEPS.length - 1 ? 'Next →' : 'Done!'}
          </button>
        </div>
      </div>
    </>
  )
}
