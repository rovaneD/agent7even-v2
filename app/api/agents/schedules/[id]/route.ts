import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computeNextRunAt } from '@/lib/agents/ensureDefaultSchedules'
import {
  getWorkspaceSessionFromRequest,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'

/** Pause or resume an agent schedule the workspace owns. Body: { isActive: boolean } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = workspaceDataUserId(session)
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive (boolean) is required' }, { status: 400 })
  }

  const { data: schedule } = await supabase
    .from('agent_schedules')
    .select('id, user_id, frequency, hour_of_day, next_run_at')
    .eq('id', id)
    .eq('user_id', workspaceId)
    .maybeSingle()

  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  const update: Record<string, unknown> = { is_active: body.isActive }

  // On resume, roll a stale next_run_at forward — otherwise the hourly cron
  // fires the backlogged run the moment the schedule reactivates.
  if (body.isActive && (!schedule.next_run_at || new Date(schedule.next_run_at) <= new Date())) {
    update.next_run_at = computeNextRunAt({
      frequency: schedule.frequency,
      hourOfDay: schedule.hour_of_day,
    })
  }

  const { data: updated, error } = await supabase
    .from('agent_schedules')
    .update(update)
    .eq('id', schedule.id)
    .select('id, agent, is_active, frequency, hour_of_day, next_run_at')
    .single()

  if (error) {
    console.error('Schedule toggle failed:', error)
    return NextResponse.json({ error: 'Could not update schedule' }, { status: 500 })
  }

  return NextResponse.json({ schedule: updated })
}
