/** Canonical Foundation answer keys used in onboarding + Hub. */
export const ONBOARDING_STRING_FIELDS = [
  'businessDescription',
  'problemSolved',
  'transformation',
  'customerWho',
  'customerFrustration',
  'customerTriedBefore',
  'customerBuyingTrigger',
  'differentiator',
  'differentiatorOwn',
  'brandsAdmired',
  'neverSoundLike',
  'marketingBudget',
  'monthlyGoal',
  'visualAesthetic',
  'visualCasting',
  'visualHeroSubjects',
  'visualPaletteWords',
  'visualMustNotDepict',
] as const

export type OnboardingAnswers = Record<string, unknown> & {
  businessDescription: string
  problemSolved: string
  transformation: string
  customerWho: string
  customerFrustration: string
  customerTriedBefore: string
  customerBuyingTrigger: string
  competitors: string[]
  differentiator: string
  differentiatorOwn: string
  toneTraits: string[]
  brandsAdmired: string
  neverSoundLike: string
  marketingBudget: string
  channels: string[]
  monthlyGoal: string
  visualAesthetic: string
  visualCasting: string
  visualHeroSubjects: string
  visualPaletteWords: string
  visualMustNotDepict: string
}

export function emptyOnboardingAnswers(): OnboardingAnswers {
  return {
    businessDescription: '',
    problemSolved: '',
    transformation: '',
    customerWho: '',
    customerFrustration: '',
    customerTriedBefore: '',
    customerBuyingTrigger: '',
    competitors: ['', '', ''],
    differentiator: '',
    differentiatorOwn: '',
    toneTraits: [],
    brandsAdmired: '',
    neverSoundLike: '',
    marketingBudget: '',
    channels: [],
    monthlyGoal: '',
    visualAesthetic: '',
    visualCasting: '',
    visualHeroSubjects: '',
    visualPaletteWords: '',
    visualMustNotDepict: '',
  }
}

export function normalizeOnboardingAnswers(raw: Record<string, unknown>): OnboardingAnswers {
  const base = emptyOnboardingAnswers()
  for (const key of ONBOARDING_STRING_FIELDS) {
    const val = raw[key]
    if (typeof val === 'string') base[key] = val.trim()
  }
  if (Array.isArray(raw.competitors)) {
    base.competitors = [...raw.competitors.map(v => String(v ?? '').trim()), '', '', ''].slice(0, 3)
  }
  if (Array.isArray(raw.toneTraits)) {
    base.toneTraits = raw.toneTraits.map(v => String(v).trim()).filter(Boolean)
  } else if (typeof raw.toneTraits === 'string' && raw.toneTraits.trim()) {
    base.toneTraits = raw.toneTraits.split(',').map(s => s.trim()).filter(Boolean)
  }
  if (Array.isArray(raw.channels)) {
    base.channels = raw.channels.map(v => String(v).trim()).filter(Boolean)
  } else if (typeof raw.channels === 'string' && raw.channels.trim()) {
    base.channels = raw.channels.split(',').map(s => s.trim()).filter(Boolean)
  }
  return base
}
