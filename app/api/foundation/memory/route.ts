import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computeMemoryStats } from '@/lib/foundation/memory'

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

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: outputs } = await supabase
      .from('agent_outputs')
      .select('status, created_at, agent_tasks(agent)')
      .eq('user_id', profile.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    return NextResponse.json(computeMemoryStats((outputs ?? []) as never[]))
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
