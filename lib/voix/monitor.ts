import type { SupabaseClient } from '@supabase/supabase-js'
import type { VoixAccount, VoixOutcome } from '@/lib/voix/types'

/**
 * Cross-spa health for the Voix admin monitor: what each spa's callers and
 * staff are experiencing, and whether the plumbing (webhook, digest) works.
 * Sample calls are excluded everywhere.
 */

export type Severity = 'critical' | 'warning'
export type Problem = { severity: Severity; text: string }

export type SpaHealth = {
  account: Pick<VoixAccount, 'id' | 'name' | 'status' | 'timezone' | 'retell_agent_ids' | 'digest_enabled'>
  callsToday: number
  calls7d: number
  booked7d: number
  person7d: number
  earlyHangups7d: number
  hangupRate7d: number | null
  stuckCalls: number
  lastCallAt: string | null
  openFollowups: number
  urgentOpen: number
  overdueFollowups: number
  oldestOpenAt: string | null
  avgHoursToDone7d: number | null
  staffInvited: number
  staffJoined: number
  staffLastSeenAt: string | null
  lastDigestAt: string | null
  lastDigestError: string | null
  lastWebhookAt: string | null
  webhookErrors24h: number
  problems: Problem[]
}

export type WebhookProblem = {
  id: string
  received_at: string
  event: string | null
  result: string
  detail: string | null
  account_id: string | null
  agent_id: string | null
}

export type FlaggedCall = {
  id: string
  account_id: string
  caller_name: string | null
  from_number: string | null
  started_at: string | null
  outcome: VoixOutcome | null
  urgent: boolean
  summary: string | null
  followup_status: string | null
}

export type MonitorData = {
  spas: SpaHealth[]
  lastWebhookAt: string | null
  webhookErrors24h: number
  badSignatures24h: number
  webhookProblems: WebhookProblem[]
  flagged: FlaggedCall[]
}

const BOOKED: VoixOutcome[] = ['booked', 'rescheduled']
const PERSON: VoixOutcome[] = ['callback_needed', 'clinical', 'complaint']

/** PostgREST caps responses (often 1,000 rows): page through. */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
  maxRows = 20000,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return out
}

function hoursSince(iso: string, now: number) {
  return (now - new Date(iso).getTime()) / 3_600_000
}

export async function loadMonitor(supabase: SupabaseClient, accounts: VoixAccount[]): Promise<MonitorData> {
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const since7d = new Date(now - 7 * 86_400_000).toISOString()
  const since24h = new Date(now - 86_400_000).toISOString()

  type CallRow = {
    account_id: string
    started_at: string | null
    created_at: string
    duration_sec: number | null
    outcome: VoixOutcome | null
    status: string
  }
  type FupRow = {
    account_id: string
    status: string
    priority: string
    snoozed_until: string | null
    created_at: string
    done_at: string | null
  }

  const [calls7d, fups, members, webhookRows, digestRows, flaggedRows] = await Promise.all([
    fetchAll<CallRow>((from, to) =>
      supabase
        .from('voix_calls')
        .select('account_id, started_at, created_at, duration_sec, outcome, status')
        .eq('is_sample', false)
        .gte('created_at', since7d)
        .order('created_at', { ascending: false })
        .range(from, to),
    ),
    fetchAll<FupRow>((from, to) =>
      supabase
        .from('voix_followups')
        .select('account_id, status, priority, snoozed_until, created_at, done_at, call:voix_calls!voix_followups_call_id_fkey!inner(is_sample)')
        .eq('call.is_sample', false)
        .or(`status.neq.done,done_at.gte.${since7d}`)
        .order('created_at', { ascending: true })
        .range(from, to),
    ),
    supabase.from('voix_members').select('account_id, joined_at, last_seen_at'),
    fetchAll<WebhookProblem>((from, to) =>
      supabase
        .from('voix_webhook_events')
        .select('id, received_at, event, result, detail, account_id, agent_id')
        .gte('received_at', since7d)
        .order('received_at', { ascending: false })
        .range(from, to),
    ),
    supabase
      .from('voix_digest_log')
      .select('account_id, sent_at, error')
      .eq('is_test', false)
      .order('sent_at', { ascending: false })
      .limit(500),
    supabase
      .from('voix_calls')
      .select('id, account_id, caller_name, from_number, started_at, outcome, urgent, summary, voix_followups(status)')
      .eq('is_sample', false)
      .gte('created_at', since7d)
      .or('urgent.eq.true,outcome.in.(clinical,complaint)')
      .order('started_at', { ascending: false })
      .limit(20),
  ])

  // Last call ever per spa (cheap: one ordered query per spa).
  const lastCall = new Map<string, string | null>()
  await Promise.all(
    accounts.map(async (a) => {
      const { data } = await supabase
        .from('voix_calls')
        .select('started_at')
        .eq('account_id', a.id)
        .eq('is_sample', false)
        .order('started_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      lastCall.set(a.id, (data?.started_at as string | null) ?? null)
    }),
  )

  const memberRows = (members.data ?? []) as { account_id: string; joined_at: string | null; last_seen_at: string | null }[]
  const digests = (digestRows.data ?? []) as { account_id: string; sent_at: string; error: string | null }[]

  const spas: SpaHealth[] = accounts.map((a) => {
    const tzToday = new Intl.DateTimeFormat('en-CA', { timeZone: a.timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const todayKey = tzToday.format(new Date(now))
    const calls = calls7d.filter((c) => c.account_id === a.id)
    const callsToday = calls.filter((c) => c.started_at && tzToday.format(new Date(c.started_at)) === todayKey).length
    const ended = calls.filter((c) => c.status !== 'ongoing')
    const earlyHangups = ended.filter((c) => (c.duration_sec ?? 0) < 15 && c.outcome !== 'spam').length
    const stuck = calls.filter((c) => c.status !== 'analyzed' && hoursSince(c.created_at, now) > 0.25).length

    const accFups = fups.filter((f) => f.account_id === a.id)
    const open = accFups.filter((f) => f.status === 'open' || (f.status === 'snoozed' && f.snoozed_until && f.snoozed_until <= nowIso))
    const urgentOpen = open.filter((f) => f.priority === 'urgent')
    const overdue = open.filter((f) => hoursSince(f.created_at, now) > 24)
    const done = accFups.filter((f) => f.status === 'done' && f.done_at && f.done_at >= since7d)
    const avgDone = done.length
      ? done.reduce((s, f) => s + (new Date(f.done_at!).getTime() - new Date(f.created_at).getTime()), 0) / done.length / 3_600_000
      : null

    const accMembers = memberRows.filter((m) => m.account_id === a.id)
    const lastSeen = accMembers.map((m) => m.last_seen_at).filter(Boolean).sort().pop() ?? null
    const digest = digests.find((d) => d.account_id === a.id) ?? null
    const hooks = webhookRows.filter((w) => w.account_id === a.id)
    const hookErrors = hooks.filter((w) => w.result === 'error' && w.received_at >= since24h).length

    const problems: Problem[] = []
    const staleUrgent = urgentOpen.filter((f) => hoursSince(f.created_at, now) > 1)
    if (staleUrgent.length) problems.push({ severity: 'critical', text: `${staleUrgent.length} urgent follow-up${staleUrgent.length > 1 ? 's' : ''} waiting over 1 hour` })
    if (hookErrors) problems.push({ severity: 'critical', text: `${hookErrors} webhook error${hookErrors > 1 ? 's' : ''} in 24h` })
    if (stuck) problems.push({ severity: 'warning', text: `${stuck} call${stuck > 1 ? 's' : ''} never got a summary` })
    if (overdue.length) problems.push({ severity: 'warning', text: `${overdue.length} follow-up${overdue.length > 1 ? 's' : ''} older than 24h` })
    if (!a.retell_agent_ids.length) problems.push({ severity: 'warning', text: 'No Retell agent linked' })
    if (a.status !== 'paused' && a.retell_agent_ids.length) {
      const last = lastCall.get(a.id)
      if (!last) problems.push({ severity: 'warning', text: 'No real calls received yet' })
      else if (hoursSince(last, now) > 48) problems.push({ severity: 'warning', text: 'No calls in 48h — is forwarding still on?' })
    }
    if (ended.length >= 5 && earlyHangups / ended.length > 0.2)
      problems.push({ severity: 'warning', text: `${Math.round((earlyHangups / ended.length) * 100)}% of callers hang up in the first 15s` })
    if (accMembers.length && !accMembers.some((m) => m.joined_at)) problems.push({ severity: 'warning', text: 'No staff have signed in yet' })
    else if (lastSeen && hoursSince(lastSeen, now) > 72 && open.length)
      problems.push({ severity: 'warning', text: 'Staff haven’t opened the dashboard in 3 days' })
    if (digest?.error) problems.push({ severity: 'warning', text: 'Last daily digest failed to send' })

    return {
      account: {
        id: a.id,
        name: a.name,
        status: a.status,
        timezone: a.timezone,
        retell_agent_ids: a.retell_agent_ids,
        digest_enabled: a.digest_enabled,
      },
      callsToday,
      calls7d: calls.length,
      booked7d: calls.filter((c) => c.outcome && BOOKED.includes(c.outcome)).length,
      person7d: calls.filter((c) => c.outcome && PERSON.includes(c.outcome)).length,
      earlyHangups7d: earlyHangups,
      hangupRate7d: ended.length ? earlyHangups / ended.length : null,
      stuckCalls: stuck,
      lastCallAt: lastCall.get(a.id) ?? null,
      openFollowups: open.length,
      urgentOpen: urgentOpen.length,
      overdueFollowups: overdue.length,
      oldestOpenAt: open[0]?.created_at ?? null,
      avgHoursToDone7d: avgDone,
      staffInvited: accMembers.length,
      staffJoined: accMembers.filter((m) => m.joined_at).length,
      staffLastSeenAt: lastSeen,
      lastDigestAt: digest?.sent_at ?? null,
      lastDigestError: digest?.error ?? null,
      lastWebhookAt: hooks[0]?.received_at ?? null,
      webhookErrors24h: hookErrors,
      problems,
    }
  })

  const flagged = ((flaggedRows.data ?? []) as (Omit<FlaggedCall, 'followup_status'> & {
    voix_followups: { status: string }[] | { status: string } | null
  })[]).map((c) => {
    const f = Array.isArray(c.voix_followups) ? c.voix_followups[0] : c.voix_followups
    const { voix_followups: _unused, ...rest } = c
    void _unused
    return { ...rest, followup_status: f?.status ?? null }
  })

  return {
    spas: spas.sort((x, y) => {
      const score = (s: SpaHealth) => s.problems.filter((p) => p.severity === 'critical').length * 10 + s.problems.length
      return score(y) - score(x) || x.account.name.localeCompare(y.account.name)
    }),
    lastWebhookAt: webhookRows[0]?.received_at ?? null,
    webhookErrors24h: webhookRows.filter((w) => w.result === 'error' && w.received_at >= since24h).length,
    badSignatures24h: webhookRows.filter((w) => w.result === 'bad_signature' && w.received_at >= since24h).length,
    webhookProblems: webhookRows.filter((w) => w.result !== 'stored').slice(0, 20),
    flagged,
  }
}
