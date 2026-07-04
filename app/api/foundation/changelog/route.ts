import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { loadFoundationChangelogRows } from '@/lib/foundation/observer/loadChangelogRows'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const limit = 30
    const rows = await loadFoundationChangelogRows(profile.id, limit)

    return NextResponse.json({
      rows: rows.map(row => ({
        id: row.id,
        signalType: row.signal_type,
        agentId: row.agent_id,
        summary: row.content_summary,
        createdAt: row.created_at,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
