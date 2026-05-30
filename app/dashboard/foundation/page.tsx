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
    .select('id, company_name, foundation_answers, foundation_score, foundation_updated_at, foundation_complete')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile?.id) redirect('/foundation')

  const { data: fieldScores } = await supabase
    .from('foundation_field_scores')
    .select('field_key, score, feedback')
    .eq('user_id', profile.id)

  return (
    <FoundationEditor
      profileId={profile.id}
      companyName={profile.company_name ?? ''}
      initialAnswers={profile.foundation_answers ?? null}
      initialScore={profile.foundation_score ?? 0}
      initialFieldScores={
        Object.fromEntries((fieldScores ?? []).map(r => [r.field_key, { score: r.score, feedback: r.feedback }]))
      }
      foundationComplete={profile.foundation_complete ?? false}
      lastUpdated={profile.foundation_updated_at ?? null}
    />
  )
}
