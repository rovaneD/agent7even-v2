'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useUser, SignOutButton } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check } from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────

const INDUSTRY_SUGGESTIONS = [
  'Skincare', 'Clothing boutique', 'Restaurant', 'Fitness studio',
  'Photography', 'Real estate', 'Coaching', 'E-commerce', 'Beauty salon',
  'Food & beverage', 'Jewelry', 'Interior design', 'Health & wellness',
  'Pet care', 'Marketing agency', 'Consulting', 'Hair salon', 'Bakery',
  'Online course', 'Wedding planner',
]

const SELL_LOCATIONS = [
  'My website', 'Instagram / DMs', 'Physical store', 'Amazon / Etsy', 'Not selling yet',
]

const BUDGET_OPTIONS = [
  'Under $200', '$200–$500', '$500–$1,500', '$1,500–$5,000', '$5,000+',
]

const GOAL_OPTIONS = [
  'Get more followers', 'Drive website traffic', 'Launch a new product',
  'Build an email list', 'Run my first ad campaign', 'Post more consistently',
  'Improve my brand', 'Get more reviews', 'Something else',
]

const CHALLENGE_OPTIONS = [
  "Not enough time", "Don't know what to post", "Tried agencies — didn't work",
  "No budget", "Don't know if it's working", "Just getting started",
]

const CONTENT_COMFORT_OPTIONS = [
  { value: 'confident', label: 'I post regularly and know what I\'m doing' },
  { value: 'inconsistent', label: 'I post sometimes but feel inconsistent' },
  { value: 'unsure', label: 'I rarely post — not sure where to start' },
  { value: 'no_camera', label: "I don't want to be on camera at all" },
]

const TOTAL_STEPS = 5

// ── Shared UI ──────────────────────────────────────────────────────────────

function Pill({
  label, selected, onClick, disabled,
}: { label: string; selected: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-full text-sm border transition-all ${
        selected
          ? 'border-[#c8522a]/60 bg-[#c8522a]/15 text-white'
          : 'border-white/10 bg-white/5 text-white/60 hover:border-white/25 hover:text-white/80'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {label}
    </button>
  )
}

function ContinueBtn({ onClick, disabled, label = 'Continue' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 bg-[#c8522a] text-white text-sm font-medium px-6 py-3 rounded-xl disabled:opacity-30 hover:bg-[#b04623] transition-colors mt-6"
    >
      {label} <ArrowRight size={14} />
    </button>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

function OnboardingInner() {
  const { user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan')

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [showReveal, setShowReveal] = useState(false)

  // Step 1
  const [companyName, setCompanyName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [industrySuggestions, setIndustrySuggestions] = useState<string[]>([])
  const [idealCustomer, setIdealCustomer] = useState('')

  // Step 2
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [instagramHandle, setInstagramHandle] = useState('')
  const [sellLocations, setSellLocations] = useState<string[]>([])
  const [marketingBudget, setMarketingBudget] = useState('')

  // Step 3
  const [competitor1, setCompetitor1] = useState('')
  const [competitor2, setCompetitor2] = useState('')
  const [competitor3, setCompetitor3] = useState('')

  // Step 4
  const [topGoals, setTopGoals] = useState<string[]>([])
  const [marketingChallenge, setMarketingChallenge] = useState('')

  // Step 5
  const [contentComfort, setContentComfort] = useState('')

  const nameRef = useRef<HTMLInputElement>(null)

  // Pre-fill from Clerk
  useEffect(() => {
    if (user?.fullName) setCompanyName(user.fullName)
  }, [user])

  // Industry type-ahead
  useEffect(() => {
    if (!businessType.trim()) { setIndustrySuggestions([]); return }
    const q = businessType.toLowerCase()
    setIndustrySuggestions(
      INDUSTRY_SUGGESTIONS.filter(s => s.toLowerCase().includes(q) && s.toLowerCase() !== q).slice(0, 5)
    )
  }, [businessType])

  useEffect(() => {
    if (step === 0) setTimeout(() => nameRef.current?.focus(), 300)
  }, [step])

  function toggleSellLocation(val: string) {
    setSellLocations(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  function toggleGoal(val: string) {
    setTopGoals(prev =>
      prev.includes(val)
        ? prev.filter(v => v !== val)
        : prev.length < 3 ? [...prev, val] : prev
    )
  }

  async function handleSubmit() {
    setSaving(true)
    const competitorList = [competitor1, competitor2, competitor3].map(c => c.trim().replace(/^@/, '')).filter(Boolean)

    const payload = {
      companyName: companyName.trim(),
      businessType: businessType.trim(),
      idealCustomer: idealCustomer.trim(),
      websiteUrl: websiteUrl.trim(),
      instagramHandle: instagramHandle.trim().replace(/^@/, ''),
      sellLocations,
      marketingBudget,
      competitors: competitorList,
      topGoals,
      marketingChallenge,
      contentComfort,
    }

    console.log('Onboarding submit payload:', payload)

    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Onboarding API error:', err)
      }
    } catch (err) {
      console.error('Onboarding fetch failed:', err)
    }

    setSaving(false)
    setShowReveal(true)
  }

  function goNext() { setStep(s => s + 1) }

  const progress = ((step) / TOTAL_STEPS) * 100

  // ── Reveal screen ──────────────────────────────────────────────────────────

  if (showReveal) {
    const competitors = [competitor1, competitor2, competitor3].filter(Boolean)
    const bullets = [
      businessType ? `${companyName || 'Your business'} · ${businessType}` : companyName,
      topGoals.length ? `Goals: ${topGoals.slice(0, 2).join(', ')}` : null,
      competitors.length ? `Watching: ${competitors.map(c => `@${c.replace(/^@/, '')}`).join(', ')}` : null,
      idealCustomer ? `Customer: ${idealCustomer.slice(0, 60)}${idealCustomer.length > 60 ? '…' : ''}` : null,
    ].filter(Boolean) as string[]

    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-8">
        <div className="max-w-md w-full text-center">
          {/* Maya avatar */}
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
              <span className="text-[#0d0d0d] text-xl font-bold">M</span>
            </div>
          </div>

          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Ready</p>
          <h2 className="text-white text-2xl font-medium mb-2 tracking-tight">Maya has reviewed your profile.</h2>
          <p className="text-white/40 text-sm mb-8">Here's what she's working with:</p>

          <div className="text-left bg-white/3 border border-white/8 rounded-2xl p-5 mb-8 flex flex-col gap-3">
            {bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-full bg-[#c8522a]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={9} className="text-[#c8522a]" />
                </div>
                <p className="text-white/80 text-sm leading-relaxed">{b}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push(plan ? `/checkout-now?plan=${plan}` : '/maya?new=true')}
            className="w-full flex items-center justify-center gap-2 bg-white text-[#0d0d0d] text-sm font-semibold px-6 py-4 rounded-xl hover:bg-white/90 transition-colors"
          >
            Let's build your first campaign <ArrowRight size={15} />
          </button>
        </div>
      </div>
    )
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (saving) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-center">
          <div className="w-2 h-2 rounded-full bg-[#c8522a] animate-pulse mx-auto mb-4" />
          <p className="text-white/40 text-sm">Setting up Maya...</p>
        </div>
      </div>
    )
  }

  // ── Step screens ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col">

      {/* Progress */}
      <div className="w-full h-0.5 bg-white/5">
        <div className="h-full bg-[#c8522a] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5">
        <span className="text-white font-bold text-sm tracking-wide">
          AGENT<span className="text-[#c8522a]">7</span>EVEN
        </span>
        <div className="flex items-center gap-5">
          <span className="text-white/20 text-xs">{step + 1} of {TOTAL_STEPS}</span>
          <SignOutButton redirectUrl="/sign-in">
            <button className="text-white/30 hover:text-white/60 text-xs transition-colors">Sign out</button>
          </SignOutButton>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full px-8 pb-16">

        {/* ── STEP 1: Business identity ── */}
        {step === 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Step 1 · Business</p>
            <h2 className="text-white text-2xl font-medium mb-8 leading-snug tracking-tight">
              Let's start with your business.
            </h2>

            <div className="flex flex-col gap-5">
              <div>
                <label className="text-white/40 text-xs uppercase tracking-widest mb-2 block">Business name</label>
                <input
                  ref={nameRef}
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && companyName.trim() && nameRef.current?.blur()}
                  placeholder="e.g. Bloom Skincare"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#c8522a]/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-white/40 text-xs uppercase tracking-widest mb-2 block">Industry</label>
                <input
                  value={businessType}
                  onChange={e => setBusinessType(e.target.value)}
                  placeholder="e.g. Skincare, Restaurant, Coaching..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#c8522a]/50 transition-colors"
                />
                {industrySuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {industrySuggestions.map(s => (
                      <button
                        key={s}
                        onClick={() => { setBusinessType(s); setIndustrySuggestions([]) }}
                        className="px-3 py-1 rounded-full text-xs border border-white/10 bg-white/5 text-white/50 hover:border-[#c8522a]/40 hover:text-white/80 transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-white/40 text-xs uppercase tracking-widest mb-2 block">Ideal customer</label>
                <input
                  value={idealCustomer}
                  onChange={e => setIdealCustomer(e.target.value)}
                  placeholder="e.g. Women 35–50 dealing with hormonal skin changes"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#c8522a]/50 transition-colors"
                />
              </div>
            </div>

            <ContinueBtn onClick={goNext} disabled={!companyName.trim() || !businessType.trim()} />
          </div>
        )}

        {/* ── STEP 2: Where they are now ── */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Step 2 · Your presence</p>
            <h2 className="text-white text-2xl font-medium mb-8 leading-snug tracking-tight">
              Where are you right now?
            </h2>

            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/40 text-xs uppercase tracking-widest mb-2 block">Website (optional)</label>
                  <input
                    value={websiteUrl}
                    onChange={e => setWebsiteUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#c8522a]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-white/40 text-xs uppercase tracking-widest mb-2 block">Instagram (optional)</label>
                  <input
                    value={instagramHandle}
                    onChange={e => setInstagramHandle(e.target.value)}
                    placeholder="@yourbusiness"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#c8522a]/50 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-white/40 text-xs uppercase tracking-widest mb-3 block">Where do you sell?</label>
                <div className="flex flex-wrap gap-2">
                  {SELL_LOCATIONS.map(loc => (
                    <Pill key={loc} label={loc} selected={sellLocations.includes(loc)} onClick={() => toggleSellLocation(loc)} />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-white/40 text-xs uppercase tracking-widest mb-3 block">Monthly marketing budget</label>
                <div className="flex flex-wrap gap-2">
                  {BUDGET_OPTIONS.map(b => (
                    <Pill key={b} label={b} selected={marketingBudget === b} onClick={() => setMarketingBudget(b)} />
                  ))}
                </div>
              </div>
            </div>

            <ContinueBtn onClick={goNext} disabled={sellLocations.length === 0 || !marketingBudget} />
          </div>
        )}

        {/* ── STEP 3: Competitors ── */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Step 3 · Competition</p>
            <h2 className="text-white text-2xl font-medium mb-2 leading-snug tracking-tight">
              Who are your main competitors?
            </h2>
            <p className="text-white/40 text-sm mb-8">Add up to 3 Instagram handles or business names. Maya will keep an eye on them.</p>

            <div className="flex flex-col gap-3">
              {[
                { val: competitor1, set: setCompetitor1 },
                { val: competitor2, set: setCompetitor2 },
                { val: competitor3, set: setCompetitor3 },
              ].map((c, i) => (
                <input
                  key={i}
                  value={c.val}
                  onChange={e => c.set(e.target.value)}
                  placeholder="@competitor"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#c8522a]/50 transition-colors"
                />
              ))}
            </div>

            <p className="text-white/25 text-xs mt-4">
              Not sure? Skip this — Maya will suggest competitors based on your industry.
            </p>

            <ContinueBtn onClick={goNext} label="Continue" />
          </div>
        )}

        {/* ── STEP 4: Goals and challenges ── */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Step 4 · Priorities</p>
            <h2 className="text-white text-2xl font-medium mb-2 leading-snug tracking-tight">
              What are you focused on?
            </h2>
            <p className="text-white/40 text-sm mb-6">Pick up to 3 priorities for the next 30 days.</p>

            <div className="flex flex-wrap gap-2 mb-8">
              {GOAL_OPTIONS.map(g => (
                <Pill
                  key={g} label={g}
                  selected={topGoals.includes(g)}
                  onClick={() => toggleGoal(g)}
                  disabled={topGoals.length >= 3 && !topGoals.includes(g)}
                />
              ))}
            </div>

            <div>
              <p className="text-white/40 text-sm mb-3">What's been hardest about marketing so far?</p>
              <div className="flex flex-col gap-2">
                {CHALLENGE_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => setMarketingChallenge(c)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm transition-all ${
                      marketingChallenge === c
                        ? 'border-[#c8522a]/60 bg-[#c8522a]/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80'
                    }`}
                  >
                    {marketingChallenge === c && <Check size={13} className="text-[#c8522a] flex-shrink-0" />}
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <ContinueBtn onClick={goNext} disabled={topGoals.length === 0 || !marketingChallenge} />
          </div>
        )}

        {/* ── STEP 5: Content comfort ── */}
        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Step 5 · Content</p>
            <h2 className="text-white text-2xl font-medium mb-2 leading-snug tracking-tight">
              How comfortable are you creating content?
            </h2>
            <p className="text-white/40 text-sm mb-8">This helps Maya calibrate what to suggest for you.</p>

            <div className="flex flex-col gap-2">
              {CONTENT_COMFORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setContentComfort(opt.value)}
                  className={`flex items-center gap-3 px-4 py-4 rounded-xl border text-left text-sm transition-all ${
                    contentComfort === opt.value
                      ? 'border-[#c8522a]/60 bg-[#c8522a]/10 text-white'
                      : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-all ${
                    contentComfort === opt.value ? 'border-[#c8522a] bg-[#c8522a]' : 'border-white/20'
                  }`}>
                    {contentComfort === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  {opt.label}
                </button>
              ))}
            </div>

            <ContinueBtn
              onClick={handleSubmit}
              disabled={!contentComfort}
              label="Meet Maya"
            />
          </div>
        )}

      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingInner />
    </Suspense>
  )
}
