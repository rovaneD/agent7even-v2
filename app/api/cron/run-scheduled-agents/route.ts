import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createTask } from '@/lib/agents/runner'
import { dispatchAgentTask } from '@/lib/agents/dispatch'
import { AgentId } from '@/lib/agents/registry'

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

  const results: string[] = []

  for (const schedule of schedules) {
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

      // Compute next run time
      const next = new Date(now)
      if (schedule.frequency === 'daily') {
        next.setDate(next.getDate() + 1)
      } else if (schedule.frequency === 'weekly') {
        next.setDate(next.getDate() + 7)
      } else if (schedule.frequency === 'monthly') {
        next.setMonth(next.getMonth() + 1)
      }
      next.setHours(schedule.hour_of_day ?? 8, 0, 0, 0)

      await supabase
        .from('agent_schedules')
        .update({ last_run_at: now.toISOString(), next_run_at: next.toISOString() })
        .eq('id', schedule.id)

      results.push(`${schedule.agent} fired for user ${schedule.user_id}`)
    } catch (err) {
      results.push(`${schedule.agent} FAILED: ${String(err)}`)
    }
  }

  return NextResponse.json({ fired: results.length, results })
}
