import { enrichFromWebsite } from '@/lib/foundation/enrichFromWebsite'
import {
  emptyOnboardingAnswers,
  normalizeOnboardingAnswers,
  type OnboardingAnswers,
} from '@/lib/foundation/onboardingAnswerShape'
import type { OnboardingBusinessTypeId } from '@/lib/foundation/onboardingBusinessTypes'
import { synthesizeOnboardingAnswers } from '@/lib/foundation/synthesizeOnboardingAnswers'
import type { SiteSnapshot } from '@/lib/foundation/siteSnapshot'
import { normalizeWebsiteUrl } from '@/lib/maya/canonicalWebsite'
import {
  exaReadSite,
  exaSynthesizeFoundation,
  type FoundationSuggestions,
} from '@/lib/research/exa'

export type OnboardChecklistItem = {
  id: string
  label: string
  ready: boolean
}

export type OnboardFromWebsiteSuccess = {
  ok: true
  answers: OnboardingAnswers
  businessType: OnboardingBusinessTypeId | null
  websiteUrl: string
  hostname: string
  siteTitle: string | null
  siteSnapshot: SiteSnapshot | null
  checklist: OnboardChecklistItem[]
}

export type OnboardFromWebsiteResult =
  | OnboardFromWebsiteSuccess
  | { ok: false; reason: 'invalid_url' | 'read_failed' | 'synthesis_failed' }

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Onboarding uses relaxed gates — partial research still helps first impression. */
function mergeExaSuggestions(
  primary: FoundationSuggestions | null | undefined,
  fallback: FoundationSuggestions | null | undefined,
): FoundationSuggestions {
  const out: FoundationSuggestions = {}
  const keys: (keyof FoundationSuggestions)[] = [
    'businessDescription',
    'problemSolved',
    'transformation',
    'customerWho',
    'competitors',
    'differentiatorOwn',
  ]
  for (const key of keys) {
    const a = primary?.[key]
    const b = fallback?.[key]
    if (key === 'competitors') {
      if (Array.isArray(a) && a.length) out.competitors = a
      else if (Array.isArray(b) && b.length) out.competitors = b
      continue
    }
    if (typeof a === 'string' && a.trim()) out[key] = a
    else if (typeof b === 'string' && b.trim()) out[key] = b
  }
  return out
}

function buildChecklist(answers: OnboardingAnswers): OnboardChecklistItem[] {
  const identityReady =
    answers.businessDescription.trim().length > 40 &&
    answers.problemSolved.trim().length > 20
  const audienceReady =
    answers.customerWho.trim().length > 25 &&
    answers.customerFrustration.trim().length > 20
  const positioningReady =
    answers.differentiatorOwn.trim().length > 15 ||
    answers.competitors.some(c => c.trim().length > 0)

  return [
    { id: 'identity', label: 'Core identity is accurate', ready: identityReady },
    { id: 'audience', label: 'Target audience is relevant', ready: audienceReady },
    { id: 'positioning', label: 'Marketing positioning makes sense', ready: positioningReady },
  ]
}

function snapshotFallbackAnswers(snapshot: SiteSnapshot): Partial<OnboardingAnswers> {
  const segments = snapshot.customerSegments ?? []
  const primarySegment = segments[0]
  return {
    businessDescription: snapshot.businessOverview,
    problemSolved: snapshot.competitiveAdvantages[0] ?? '',
    transformation: snapshot.marketPositioning.primary,
    customerWho: segments.map(s => `${s.label}: ${s.description}`).join(' · ') || primarySegment?.description || '',
    customerFrustration: primarySegment?.description ?? '',
    differentiatorOwn: snapshot.competitiveAdvantages.slice(0, 2).join('. '),
  }
}

export async function onboardFromWebsite(input: {
  website: string
  companyName?: string | null
}): Promise<OnboardFromWebsiteResult> {
  const normalized = normalizeWebsiteUrl(input.website.trim())
  if (!normalized) return { ok: false, reason: 'invalid_url' }

  const companyName = input.companyName?.trim() || hostnameFromUrl(normalized)

  const siteRead = await exaReadSite(normalized)
  const seed = companyName || siteRead?.title || normalized

  const [exaSynthesis, snapshotResult] = await Promise.all([
    seed ? exaSynthesizeFoundation(seed, siteRead?.text) : Promise.resolve(null),
    enrichFromWebsite({ websiteUrl: normalized, companyName }).catch(() => null),
  ])

  const exaSuggestions = mergeExaSuggestions(exaSynthesis?.suggestions, null)

  const synthesized = await synthesizeOnboardingAnswers({
    companyName,
    websiteUrl: normalized,
    siteText: siteRead?.text,
    siteTitle: siteRead?.title ?? null,
    exaSuggestions: Object.keys(exaSuggestions).length ? exaSuggestions : null,
    siteSnapshot: snapshotResult,
  })

  let answers = synthesized?.answers ?? null
  let businessType = synthesized?.businessType ?? null

  if (!answers && snapshotResult) {
    answers = normalizeOnboardingAnswers({
      ...emptyOnboardingAnswers(),
      ...snapshotFallbackAnswers(snapshotResult),
      competitors: ['', '', ''],
    })
  }

  if (!answers && siteRead?.text?.trim()) {
    answers = normalizeOnboardingAnswers({
      ...emptyOnboardingAnswers(),
      businessDescription: siteRead.text.trim().slice(0, 500),
    })
  }

  if (!answers) return { ok: false, reason: 'synthesis_failed' }
  if (!siteRead?.text?.trim() && !snapshotResult) {
    return { ok: false, reason: 'read_failed' }
  }

  return {
    ok: true,
    answers,
    businessType,
    websiteUrl: normalized,
    hostname: hostnameFromUrl(normalized),
    siteTitle: siteRead?.title ?? null,
    siteSnapshot: snapshotResult,
    checklist: buildChecklist(answers),
  }
}
