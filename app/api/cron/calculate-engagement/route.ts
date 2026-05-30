import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const EVENT_POINTS: Record<string, number> = {
  maya_message:        3,
  agent_run:           5,
  agent_approved:      4,
  campaign_created:    8,
  foundation_updated:  6,
  brand_kit_updated:   4,
  analytics_viewed:    2,
  page_view:           1,
}

const MAX_SCORE = 100

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'client')

  if (!profiles?.length) return NextResponse.json({ updated: 0 })

  let updated = 0

  for (const profile of profiles) {
    const { data: events } = await supabase
      .from('client_activity_log')
      .select('event_type')
      .eq('user_id', profile.id)
      .gte('created_at', fourteenDaysAgo)

    if (!events) continue

    const rawScore = events.reduce((sum, e) => sum + (EVENT_POINTS[e.event_type] ?? 0), 0)
    const score = Math.min(rawScore, MAX_SCORE)

    await supabase
      .from('profiles')
      .update({
        engagement_score:      score,
        engagement_updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    updated++
  }

  return NextResponse.json({ updated })
}
