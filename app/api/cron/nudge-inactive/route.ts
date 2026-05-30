import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: inactive } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'client')
    .lt('last_active_at', fortyEightHoursAgo)
    .or(`last_nudged_at.is.null,last_nudged_at.lt.${sevenDaysAgo}`)

  if (!inactive?.length) return NextResponse.json({ nudged: 0 })

  let nudged = 0

  for (const client of inactive) {
    const firstName = client.full_name?.split(' ')[0] ?? 'there'

    await supabase.from('notifications').insert({
      user_id: client.id,
      type:    'maya_nudge',
      title:   'Maya has work ready for you',
      body:    `Hey ${firstName} — it's been a few days. Your agents are ready to run and there's work waiting. Want to pick up where we left off?`,
      link:    '/dashboard',
      read:    false,
    })

    await supabase
      .from('profiles')
      .update({ last_nudged_at: new Date().toISOString() })
      .eq('id', client.id)

    nudged++
  }

  return NextResponse.json({ nudged })
}
