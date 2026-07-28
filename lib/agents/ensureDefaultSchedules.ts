import type { SupabaseClient } from '@supabase/supabase-js'
import { AGENTS } from './registry'

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

/** Next slot strictly after a completed run — always UTC. */
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

/**
 * Cron must only advance next_run_at after a successful fire.
 * Failed runs and billing-ineligible skips stay due so the next hourly tick retries
 * (or runs once the account is active again).
 */
export function shouldAdvanceAgentScheduleAfterCronAttempt(
  outcome: 'fired' | 'failed' | 'ineligible',
): boolean {
  return outcome === 'fired'
}

/**
 * Previously advanced overdue next_run_at on Agents page load without firing the
 * agent — that permanently skipped due autonomous runs when cron lagged.
 * Overdue schedules must remain due until cron successfully fires them.
 */
export async function reconcileStaleAgentSchedules(
  _supabase: SupabaseClient,
  _userId: string,
): Promise<void> {
  // Intentional no-op: do not mutate next_run_at from page render.
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
