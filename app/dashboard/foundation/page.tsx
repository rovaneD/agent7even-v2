import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import FoundationEditor from './FoundationEditor'

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

  // For users who completed Foundation before scoring existed, reconstruct
  // answers from the individual profile columns saved by save-step.
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

  return (
    <FoundationEditor
      profileId={profile.id}
      companyName={profile.company_name ?? ''}
      initialAnswers={initialAnswers}
      initialScore={profile.foundation_score ?? 0}
      initialFieldScores={
        Object.fromEntries((fieldScores ?? []).map(r => [r.field_key, { score: r.score, feedback: r.feedback }]))
      }
      foundationComplete={profile.foundation_complete ?? false}
      lastUpdated={profile.foundation_updated_at ?? null}
    />
  )
}
