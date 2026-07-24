import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createTask } from '@/lib/agents/runner'
import { dispatchAgentTask } from '@/lib/agents/dispatch'
import { AgentId } from '@/lib/agents/registry'
import { advanceAgentScheduleNextRun } from '@/lib/agents/ensureDefaultSchedules'

async function bumpSchedule(
  supabase: ReturnType<typeof createServiceClient>,
  schedule: { id: string; frequency: string; hour_of_day?: number | null; agent?: string },
  from: Date,
  markLastRun: boolean,
) {
  await supabase
    .from('agent_schedules')
    .update({
      ...(markLastRun ? { last_run_at: from.toISOString() } : {}),
      next_run_at: advanceAgentScheduleNextRun(schedule, from),
    })
    .eq('id', schedule.id)
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()

  const { data: schedules, error } = await supabase
    .from('agent_schedules')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', now.toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!schedules?.length) return NextResponse.json({ fired: 0 })

  // Only run for accounts in good billing standing — schedules can outlive a
  // subscription (cancel/pause), and model spend must not.
  const userIds = [...new Set(schedules.map(s => s.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, plan, status, billing_exempt')
    .in('id', userIds)

  const profileById = new Map((profiles ?? []).map(p => [p.id, p]))
  const isEligible = (userId: string) => {
    const profile = profileById.get(userId)
    if (!profile) return false
    if (profile.billing_exempt) return true
    return Boolean(profile.plan) && profile.status === 'active'
  }

  // Self-heal accounts churned before deactivation-on-cancel shipped.
  const churnedUserIds = userIds.filter(id => profileById.get(id)?.status === 'churned')
  if (churnedUserIds.length) {
    await supabase
      .from('agent_schedules')
      .update({ is_active: false })
      .in('user_id', churnedUserIds)
  }

  const results: string[] = []

  for (const schedule of schedules) {
    if (!isEligible(schedule.user_id)) {
      await bumpSchedule(supabase, schedule, now, false)
      results.push(`${schedule.agent} skipped for user ${schedule.user_id} (billing not active)`)
      continue
    }
    try {
      const task = await createTask({
        userId: schedule.user_id,
        agent: schedule.agent as AgentId,
        input: schedule.config ?? {},
        triggerType: 'scheduled',
      })

      await dispatchAgentTask({
        taskId: task.id,
        agent: schedule.agent,
        input: schedule.config ?? {},
        userId: schedule.user_id,
      })

      await bumpSchedule(supabase, schedule, now, true)
      results.push(`${schedule.agent} fired for user ${schedule.user_id}`)
    } catch (err) {
      await bumpSchedule(supabase, schedule, now, false)
      results.push(`${schedule.agent} FAILED: ${String(err)}`)
    }
  }

  const fired = results.filter(r => r.includes(' fired ')).length
  return NextResponse.json({ fired, results })
}
