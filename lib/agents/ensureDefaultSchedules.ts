import type { SupabaseClient } from '@supabase/supabase-js'
import { AGENTS, type AgentId } from './registry'

/**
 * Agents marked autonomous have always advertised "Runs automatically" from
 * registry defaultSchedule, but nothing ever wrote rows into agent_schedules —
 * so the hourly cron had nothing to fire. This seeds the missing rows.
 *
 * Idempotent: only inserts schedules for autonomous agents that have a
 * defaultSchedule and no existing row for this user. Hours are UTC (the cron
 * runs on Vercel UTC).
 */

const SCHEDULED_AGENTS = Object.values(AGENTS).filter(
  a => a.autonomyLevel === 'autonomous' && a.defaultSchedule,
)

/** Next upcoming slot for a schedule, in UTC. Also used when resuming a paused schedule. */
export function computeNextRunAt(input: {
  frequency: string
  hourOfDay?: number | null
  dayOfWeek?: number | null
}): string {
  const next = new Date()
  const hour = input.hourOfDay ?? 8
  next.setUTCHours(hour, 0, 0, 0)

  if (input.frequency === 'weekly') {
    const targetDay = input.dayOfWeek ?? 1
    let daysAhead = (targetDay - next.getUTCDay() + 7) % 7
    if (daysAhead === 0 && next <= new Date()) daysAhead = 7
    next.setUTCDate(next.getUTCDate() + daysAhead)
  } else if (next <= new Date()) {
    // daily/monthly: if today's slot already passed, start tomorrow
    next.setUTCDate(next.getUTCDate() + 1)
  }

  return next.toISOString()
}

/** Next slot strictly after a completed (or skipped) run — always UTC. */
export function advanceAgentScheduleNextRun(
  schedule: { frequency: string; hour_of_day?: number | null; agent?: string },
  from: Date = new Date(),
): string {
  const hour = schedule.hour_of_day ?? 8
  const next = new Date(from)
  next.setUTCSeconds(0, 0)

  if (schedule.frequency === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7)
    next.setUTCHours(hour, 0, 0, 0)
    return next.toISOString()
  }

  if (schedule.frequency === 'monthly') {
    next.setUTCMonth(next.getUTCMonth() + 1)
    next.setUTCHours(hour, 0, 0, 0)
    return next.toISOString()
  }

  // daily (default)
  next.setUTCHours(hour, 0, 0, 0)
  if (next <= from) next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString()
}

/** Roll stuck next_run_at forward when the hourly cron has not advanced it (display + queue hygiene). */
export async function reconcileStaleAgentSchedules(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: rows } = await supabase
    .from('agent_schedules')
    .select('id, agent, frequency, hour_of_day, next_run_at, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)

  const overdueCutoff = Date.now() - 6 * 60 * 60 * 1000

  for (const row of rows ?? []) {
    if (!row.next_run_at || new Date(row.next_run_at).getTime() > overdueCutoff) continue

    const agentDef = AGENTS[row.agent as AgentId]
    const next_run_at = computeNextRunAt({
      frequency: row.frequency,
      hourOfDay: row.hour_of_day,
      dayOfWeek: agentDef?.defaultSchedule?.dayOfWeek,
    })

    await supabase.from('agent_schedules').update({ next_run_at }).eq('id', row.id)
  }
}

function firstRunAt(schedule: NonNullable<(typeof SCHEDULED_AGENTS)[number]['defaultSchedule']>): string {
  return computeNextRunAt(schedule)
}

export async function ensureDefaultAgentSchedules(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ seeded: string[] }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('foundation_complete')
    .eq('id', userId)
    .single()

  // Don't burn scheduled runs for accounts that never finished Foundation.
  if (!profile?.foundation_complete) return { seeded: [] }

  const { data: existing, error: readError } = await supabase
    .from('agent_schedules')
    .select('agent')
    .eq('user_id', userId)

  if (readError) {
    console.error('[ensureDefaultAgentSchedules] read failed:', readError)
    return { seeded: [] }
  }

  const existingAgents = new Set((existing ?? []).map(row => row.agent))
  const missing = SCHEDULED_AGENTS.filter(agent => !existingAgents.has(agent.id))
  if (!missing.length) return { seeded: [] }

  const rows = missing.map(agent => ({
    user_id: userId,
    agent: agent.id,
    is_active: true,
    frequency: agent.defaultSchedule!.frequency,
    hour_of_day: agent.defaultSchedule!.hourOfDay ?? 8,
    config: {},
    next_run_at: firstRunAt(agent.defaultSchedule!),
  }))

  const { error: insertError } = await supabase.from('agent_schedules').insert(rows)
  if (insertError) {
    console.error('[ensureDefaultAgentSchedules] insert failed:', insertError)
    return { seeded: [] }
  }

  return { seeded: missing.map(a => a.id) }
}
