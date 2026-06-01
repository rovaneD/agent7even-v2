'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, ArrowLeft } from 'lucide-react'
import OrchestrationProgress from '@/components/agents/OrchestrationProgress'

// ── Data ──────────────────────────────────────────────────────────────────

const SEGMENTS = [
  { id: 'past_customers',    label: 'Past customers',         description: "People who bought but haven't returned", icon: '🔄' },
  { id: 'warm_leads',        label: 'Warm leads gone quiet',  description: 'Engaged but didn\'t convert',            icon: '🌡️' },
  { id: 'current_customers', label: 'Current customers',      description: 'Upsell, retain, or get referrals',       icon: '⭐' },
  { id: 'cold_audience',     label: 'Cold audience',          description: 'Brand new, never heard of you',          icon: '🎯' },
  { id: 're_engagement',     label: 'Re-engagement',          description: 'Inactive subscribers or followers',      icon: '💬' },
]

const GOALS_BY_SEGMENT: Record<string, { id: string; label: string }[]> = {
  past_customers:    [
    { id: 'repeat_purchase', label: 'Get them to buy again' },
    { id: 'upsell',          label: 'Upsell to a higher tier' },
    { id: 'referral',        label: 'Get a referral' },
  ],
  warm_leads:        [
    { id: 'convert',         label: 'Convert to a sale' },
    { id: 'book_call',       label: 'Book a discovery call' },
    { id: 'free_offer',      label: 'Get them to try a free offer' },
  ],
  current_customers: [
    { id: 'retention',       label: 'Keep them engaged' },
    { id: 'upsell',          label: 'Upsell or cross-sell' },
    { id: 'referral',        label: 'Generate referrals' },
  ],
  cold_audience:     [
    { id: 'awareness',       label: 'Build awareness' },
    { id: 'email_list',      label: 'Drive to email list' },
    { id: 'first_purchase',  label: 'Get first purchase' },
  ],
  re_engagement:     [
    { id: 'reactivate',      label: 'Win them back' },
    { id: 'survey',          label: 'Understand why they left' },
    { id: 'soft_offer',      label: 'Make a low-risk offer' },
  ],
}

const TIMELINES = [
  { id: 14, label: '2 weeks',  description: 'Quick sprint' },
  { id: 30, label: '30 days',  description: 'Standard campaign' },
  { id: 60, label: '60 days',  description: 'Full push' },
]

const BUDGETS = [
  { id: 'under_500',  label: 'Under $500/mo' },
  { id: '500_1500',   label: '$500–$1,500/mo' },
  { id: '1500_5000',  label: '$1,500–$5,000/mo' },
  { id: 'over_5000',  label: 'Over $5,000/mo' },
]

const MODEL_OPTIONS = [
  {
    id:          'sonnet',
    model:       'anthropic/claude-sonnet-4',
    label:       'Claude Sonnet',
    description: 'Fast and capable — great for most campaigns',
    credits:     8,
  },
  {
    id:          'opus',
    model:       'anthropic/claude-opus-4',
    label:       'Claude Opus',
    description: 'Most powerful model — best for complex strategy',
    credits:     25,
  },
]

const GENERATION_STEPS = [
  'Analyzing your audience segment...',
  'Matching to your brand voice...',
  'Building week-by-week plan...',
  'Creating today\'s action list...',
  'Campaign ready',
]

// ── Component ─────────────────────────────────────────────────────────────

export default function GuidedCampaignFlow() {
  const router = useRouter()

  const [step, setStep]                   = useState(1)
  const [segment, setSegment]             = useState('')
  const [goal, setGoal]                   = useState('')
  const [timeline, setTimeline]           = useState(30)
  const [budget, setBudget]               = useState('under_500')
  const [selectedModel, setSelectedModel] = useState('sonnet')
  const [isGenerating, setIsGenerating]   = useState(false)
  const [genStep, setGenStep]             = useState(0)
  const [error, setError]                 = useState('')
  const [orchestrationId, setOrchestrationId] = useState<string | null>(null)
  const [campaignId, setCampaignId]           = useState<string | null>(null)

  const goals = GOALS_BY_SEGMENT[segment] ?? []

  async function generate() {
    setIsGenerating(true)
    setError('')

    // Animate checklist steps
    let i = 0
    const interval = setInterval(() => {
      i++
      setGenStep(i)
      if (i >= GENERATION_STEPS.length - 1) clearInterval(interval)
    }, 900)

    try {
      const option = MODEL_OPTIONS.find(o => o.id === selectedModel)!
      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode:        'guided',
          segment,
          goal,
          timelineDays: timeline,
          budget,
          model:       option.model,
          credits:     option.credits,
        }),
      })

      clearInterval(interval)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Generation failed')
      }

      const data = await res.json()

      if (data.orchestrationId) {
        setOrchestrationId(data.orchestrationId)
        if (data.campaignId) setCampaignId(data.campaignId)
        // OrchestrationProgress handles navigation via onComplete
      } else {
        setGenStep(GENERATION_STEPS.length - 1)
        setTimeout(() => {
          router.push(`/dashboard/campaigns/${data.campaignId}`)
        }, 600)
      }
    } catch (err) {
      clearInterval(interval)
      setIsGenerating(false)
      setGenStep(0)
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (isGenerating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24, padding: '0 24px' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>M</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0a0a0a', margin: '0 0 6px' }}>Building your campaign</h2>
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>
            Maya is crafting a plan tailored to your audience and goals.
          </p>
        </div>

        {orchestrationId ? (
          <div style={{ width: '100%', maxWidth: 420 }}>
            <OrchestrationProgress
              orchestrationId={orchestrationId}
              onComplete={() => {
                if (campaignId) router.push(`/dashboard/campaigns/${campaignId}`)
              }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 280 }}>
            {GENERATION_STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {i < genStep ? (
                  <CheckCircle2 size={15} color="#16a34a" />
                ) : i === genStep ? (
                  <Circle size={15} color="#c8522a" />
                ) : (
                  <Circle size={15} color="#e0e0e0" />
                )}
                <span style={{
                  fontSize: 13,
                  color: i < genStep ? '#16a34a' : i === genStep ? '#0a0a0a' : '#ccc',
                  fontWeight: i === genStep ? 500 : 400,
                }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px' }}>
      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 32 }}>
        {[1, 2, 3].map(n => (
          <div
            key={n}
            style={{
              height: 3, flex: 1, borderRadius: 2,
              background: n <= step ? '#0a0a0a' : '#e8e8e8',
              transition: 'background 0.2s',
            }}
          />
        ))}
        <span style={{ fontSize: 11, color: '#999', marginLeft: 8, whiteSpace: 'nowrap' }}>
          Step {step} of 3
        </span>
      </div>

      {/* Step 1 — Segment */}
      {step === 1 && (
        <>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0a0a0a', marginBottom: 6 }}>
            Who are you reaching?
          </h1>
          <p style={{ fontSize: 13, color: '#999', marginBottom: 24 }}>
            Pick the audience for this campaign.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
            {SEGMENTS.map(seg => (
              <SelectCard
                key={seg.id}
                selected={segment === seg.id}
                onClick={() => setSegment(seg.id)}
                icon={seg.icon}
                title={seg.label}
                description={seg.description}
              />
            ))}
          </div>
          <button
            onClick={() => { setGoal(''); setStep(2) }}
            disabled={!segment}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
              background: segment ? '#0a0a0a' : '#e8e8e8',
              color: segment ? '#fff' : '#bbb',
              fontSize: 13.5, fontWeight: 500, cursor: segment ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            Next →
          </button>
        </>
      )}

      {/* Step 2 — Goal */}
      {step === 2 && (
        <>
          <button
            onClick={() => setStep(1)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, marginBottom: 20, padding: 0 }}
          >
            <ArrowLeft size={13} /> Back
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0a0a0a', marginBottom: 6 }}>
            What&apos;s the goal?
          </h1>
          <p style={{ fontSize: 13, color: '#999', marginBottom: 24 }}>
            What do you want this campaign to achieve?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
            {goals.map(g => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                style={{
                  textAlign: 'left', padding: '14px 16px', borderRadius: 12,
                  border: `1.5px solid ${goal === g.id ? '#0a0a0a' : '#e8e8e8'}`,
                  background: goal === g.id ? '#0a0a0a' : '#fafafa',
                  color: goal === g.id ? '#fff' : '#0a0a0a',
                  fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.12s',
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep(3)}
            disabled={!goal}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
              background: goal ? '#0a0a0a' : '#e8e8e8',
              color: goal ? '#fff' : '#bbb',
              fontSize: 13.5, fontWeight: 500, cursor: goal ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            Next →
          </button>
        </>
      )}

      {/* Step 3 — Timeline + Budget + Model */}
      {step === 3 && (
        <>
          <button
            onClick={() => setStep(2)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, marginBottom: 20, padding: 0 }}
          >
            <ArrowLeft size={13} /> Back
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0a0a0a', marginBottom: 6 }}>
            Timeline &amp; budget
          </h1>
          <p style={{ fontSize: 13, color: '#999', marginBottom: 24 }}>
            Set the scope and resources for this campaign.
          </p>

          {/* Timeline */}
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#bbb', marginBottom: 10 }}>
            Timeline
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
            {TIMELINES.map(t => (
              <button
                key={t.id}
                onClick={() => setTimeline(t.id)}
                style={{
                  padding: '12px 8px', borderRadius: 12, border: `1.5px solid ${timeline === t.id ? '#0a0a0a' : '#e8e8e8'}`,
                  background: timeline === t.id ? '#0a0a0a' : '#fafafa',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 600, color: timeline === t.id ? '#fff' : '#0a0a0a', marginBottom: 2 }}>
                  {t.label}
                </p>
                <p style={{ fontSize: 11, color: timeline === t.id ? '#aaa' : '#bbb' }}>{t.description}</p>
              </button>
            ))}
          </div>

          {/* Budget */}
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#bbb', marginBottom: 10 }}>
            Monthly budget
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
            {BUDGETS.map(b => (
              <button
                key={b.id}
                onClick={() => setBudget(b.id)}
                style={{
                  padding: '11px 12px', borderRadius: 12, border: `1.5px solid ${budget === b.id ? '#0a0a0a' : '#e8e8e8'}`,
                  background: budget === b.id ? '#0a0a0a' : '#fafafa',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                  fontSize: 13, fontWeight: 500, color: budget === b.id ? '#fff' : '#0a0a0a',
                }}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Model */}
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#bbb', marginBottom: 10 }}>
            Generation quality
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
            {MODEL_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSelectedModel(opt.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 14px', borderRadius: 12, border: `1.5px solid ${selectedModel === opt.id ? '#0a0a0a' : '#e8e8e8'}`,
                  background: selectedModel === opt.id ? '#0a0a0a' : '#fafafa',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.12s',
                }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: selectedModel === opt.id ? '#fff' : '#0a0a0a', marginBottom: 2 }}>
                    {opt.label}
                  </p>
                  <p style={{ fontSize: 11.5, color: selectedModel === opt.id ? '#aaa' : '#999' }}>{opt.description}</p>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: selectedModel === opt.id ? '#888' : '#bbb', marginLeft: 16, whiteSpace: 'nowrap' }}>
                  {opt.credits} credits
                </span>
              </button>
            ))}
          </div>

          {error && (
            <p style={{ fontSize: 12.5, color: '#c8522a', marginBottom: 12 }}>{error}</p>
          )}

          <button
            onClick={generate}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: '#0a0a0a', color: '#fff',
              fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Build my campaign
          </button>
        </>
      )}
    </div>
  )
}

function SelectCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean
  onClick: () => void
  icon: string
  title: string
  description: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        borderRadius: 12, border: `1.5px solid ${selected ? '#0a0a0a' : '#e8e8e8'}`,
        background: selected ? '#0a0a0a' : '#fafafa',
        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        transition: 'all 0.12s',
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div>
        <p style={{ fontSize: 13.5, fontWeight: 500, color: selected ? '#fff' : '#0a0a0a', marginBottom: 2 }}>
          {title}
        </p>
        <p style={{ fontSize: 11.5, color: selected ? '#aaa' : '#999' }}>{description}</p>
      </div>
    </button>
  )
}
