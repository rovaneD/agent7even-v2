/**
 * Locks the cron policy: agent_schedules.next_run_at may advance only after a
 * successful scheduled fire — never on failure or billing-ineligible skip.
 *
 * Run: npx tsx scripts/verify-agent-schedule-advance.ts
 */
import { shouldAdvanceAgentScheduleAfterCronAttempt } from '../lib/agents/ensureDefaultSchedules'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(
  shouldAdvanceAgentScheduleAfterCronAttempt('fired') === true,
  'successful fire must advance next_run_at',
)
assert(
  shouldAdvanceAgentScheduleAfterCronAttempt('failed') === false,
  'failed run must leave schedule due for hourly retry',
)
assert(
  shouldAdvanceAgentScheduleAfterCronAttempt('ineligible') === false,
  'billing-ineligible skip must leave schedule due until reactivation',
)

console.log('verify-agent-schedule-advance: ok')
