import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import FoundationEditor from './FoundationEditor'
import FoundationHub from './FoundationHub'

const FOUNDATION_V2 = process.env.NEXT_PUBLIC_FOUNDATION_V2 === 'true'

export default async function FoundationPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id, company_name, foundation_answers, foundation_score,
      foundation_updated_at, foundation_complete,
      ideal_customer, marketing_challenge, competitors,
      content_comfort, marketing_budget, sell_locations, top_goals
    `)
    .eq('clerk_user_id', userId)
    .single()

  if (!profile?.id) redirect('/foundation')

  // Reconstruct answers from individual columns for users who completed Foundation
  // before the foundation_answers JSONB column existed.
  const initialAnswers: Record<string, unknown> | null = profile.foundation_answers ?? (
    profile.foundation_complete
      ? {
          businessDescription:   '',
          problemSolved:         '',
          transformation:        '',
          customerWho:           profile.ideal_customer ?? '',
          customerFrustration:   profile.marketing_challenge ?? '',
          customerTriedBefore:   '',
          customerBuyingTrigger: '',
          competitors:           profile.competitors ?? [],
          differentiator:        '',
          differentiatorOwn:     '',
          toneTraits:            profile.content_comfort
            ? profile.content_comfort.split(', ').filter(Boolean)
            : [],
          brandsAdmired:         '',
          neverSoundLike:        '',
          marketingBudget:       profile.marketing_budget ?? '',
          channels:              profile.sell_locations ?? [],
          monthlyGoal:           Array.isArray(profile.top_goals)
            ? (profile.top_goals[0] ?? '')
            : '',
        }
      : null
  )

  const { data: fieldScores } = await supabase
    .from('foundation_field_scores')
    .select('field_key, score, feedback')
    .eq('user_id', profile.id)

  const fieldScoreMap = Object.fromEntries(
    (fieldScores ?? []).map(r => [r.field_key, { score: r.score, feedback: r.feedback }])
  )

  if (FOUNDATION_V2) {
    const toArray = (v: unknown): string[] => {
      if (Array.isArray(v)) return v as string[]
      if (typeof v === 'string' && v.trim()) return v.split(',').map(s => s.trim()).filter(Boolean)
      return []
    }
    const emptyAnswers = {
      businessDescription: '', problemSolved: '', transformation: '',
      customerWho: '', customerFrustration: '', customerTriedBefore: '',
      customerBuyingTrigger: '', competitors: ['', '', ''] as string[],
      differentiator: '', differentiatorOwn: '', toneTraits: [] as string[],
      brandsAdmired: '', neverSoundLike: '', marketingBudget: '',
      channels: [] as string[], monthlyGoal: '',
    }
    const hubAnswers = { ...emptyAnswers, ...(initialAnswers ?? {}) }

    // Defensively coerce array fields — DB may return strings
    hubAnswers.toneTraits = toArray(hubAnswers.toneTraits)
    hubAnswers.channels   = toArray(hubAnswers.channels)

    // Ensure competitors is always a 3-slot array
    const comps = toArray(hubAnswers.competitors)
    hubAnswers.competitors = [...comps, '', '', ''].slice(0, 3)

    return (
      <FoundationHub
        profileId={profile.id}
        companyName={profile.company_name ?? ''}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        answers={hubAnswers as any}
        score={profile.foundation_score ?? 0}
        fieldScores={fieldScoreMap}
        lastUpdated={profile.foundation_updated_at ?? null}
      />
    )
  }

  return (
    <FoundationEditor
      profileId={profile.id}
      companyName={profile.company_name ?? ''}
      initialAnswers={initialAnswers}
      initialScore={profile.foundation_score ?? 0}
      initialFieldScores={fieldScoreMap}
      foundationComplete={profile.foundation_complete ?? false}
      lastUpdated={profile.foundation_updated_at ?? null}
    />
  )
}
