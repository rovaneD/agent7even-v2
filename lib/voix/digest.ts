import type { SupabaseClient } from '@supabase/supabase-js'
import { getResendClient } from '@/lib/resend'
import { transactionalFromAddress } from '@/lib/email/transactionalTemplate'
import { formatPhone, formatTime, startOfZonedDay, timeAgo } from '@/lib/voix/format'
import { OUTCOME_LABELS, REASON_LABELS, type VoixAccount, type VoixFollowupReason, type VoixOutcome } from '@/lib/voix/types'

type DigestCall = {
  id: string
  caller_name: string | null
  from_number: string | null
  started_at: string | null
  outcome: VoixOutcome | null
  summary: string | null
  treatment_interest: string | null
}

type DigestFollowup = {
  id: string
  call_id: string
  reason: VoixFollowupReason
  priority: 'urgent' | 'normal'
  created_at: string
  call: { caller_name: string | null; from_number: string | null; treatment_interest: string | null } | null
}

export type DigestData = {
  account: Pick<VoixAccount, 'id' | 'name' | 'timezone'>
  dayLabel: string
  digestDate: string // YYYY-MM-DD, the local day the digest is sent
  calls: DigestCall[]
  counts: { total: number; booked: number; questions: number; person: number; noise: number }
  openFollowups: DigestFollowup[]
  openTotal: number
  urgentOpen: number
}

const BOOKED: VoixOutcome[] = ['booked', 'rescheduled']
const PERSON: VoixOutcome[] = ['callback_needed', 'clinical', 'complaint']
const NOISE: VoixOutcome[] = ['spam', 'hang_up']

export function localDateKey(timeZone: string, date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function localHour(timeZone: string, date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(date))
}

/** Yesterday's calls (spa local time) plus everything still open right now. */
export async function buildDigest(
  supabase: SupabaseClient,
  account: Pick<VoixAccount, 'id' | 'name' | 'timezone'>,
  opts: { includeSamples: boolean; now?: Date },
): Promise<DigestData> {
  const now = opts.now ?? new Date()
  const tz = account.timezone
  const from = startOfZonedDay(tz, now, -1).toISOString()
  const to = startOfZonedDay(tz, now).toISOString()

  let callsQuery = supabase
    .from('voix_calls')
    .select('id, caller_name, from_number, started_at, outcome, summary, treatment_interest')
    .eq('account_id', account.id)
    .gte('started_at', from)
    .lt('started_at', to)
    .order('started_at', { ascending: true })
    .limit(1000)
  if (!opts.includeSamples) callsQuery = callsQuery.eq('is_sample', false)

  let fupQuery = supabase
    .from('voix_followups')
    .select(
      'id, call_id, reason, priority, created_at, call:voix_calls!voix_followups_call_id_fkey(caller_name, from_number, treatment_interest, is_sample)',
    )
    .eq('account_id', account.id)
    .or(`status.eq.open,and(status.eq.snoozed,snoozed_until.lte.${now.toISOString()})`)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(200)

  const [{ data: callRows, error: callErr }, { data: fupRows, error: fupErr }] = await Promise.all([callsQuery, fupQuery])
  if (callErr) throw new Error(`digest calls: ${callErr.message}`)
  if (fupErr) throw new Error(`digest follow-ups: ${fupErr.message}`)

  const calls = (callRows ?? []) as DigestCall[]
  let fups = (fupRows ?? []) as unknown as (DigestFollowup & { call: (DigestFollowup['call'] & { is_sample?: boolean }) | null })[]
  if (!opts.includeSamples) fups = fups.filter((f) => !f.call?.is_sample)

  const count = (list: VoixOutcome[]) => calls.filter((c) => c.outcome && list.includes(c.outcome)).length
  const yesterday = new Date(startOfZonedDay(tz, now, -1).getTime() + 12 * 3_600_000)

  return {
    account,
    dayLabel: new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }).format(yesterday),
    digestDate: localDateKey(tz, now),
    calls,
    counts: {
      total: calls.length,
      booked: count(BOOKED),
      questions: count(['question_answered']),
      person: count(PERSON),
      noise: count(NOISE),
    },
    openFollowups: fups.slice(0, 8),
    openTotal: fups.length,
    urgentOpen: fups.filter((f) => f.priority === 'urgent').length,
  }
}

function esc(v: string | null | undefined): string {
  return (v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function digestSubject(d: DigestData): string {
  const parts = [`${d.counts.total} call${d.counts.total === 1 ? '' : 's'}`]
  if (d.counts.booked) parts.push(`${d.counts.booked} booked`)
  if (d.openTotal) parts.push(`${d.openTotal} to follow up`)
  return `Voix daily: ${parts.join(', ')} — ${d.account.name}`
}

export function digestHtml(d: DigestData, appUrl: string): string {
  const base = appUrl.replace(/\/$/, '')
  const accountUrl = `${base}/voix/app/${d.account.id}`
  const tz = d.account.timezone
  const who = (c: { caller_name: string | null; from_number: string | null } | null) =>
    c?.caller_name ? `${esc(c.caller_name)} <span style="color:#5B6070">${esc(formatPhone(c.from_number))}</span>` : esc(formatPhone(c?.from_number))

  const stat = (n: number, label: string) => `
    <td style="padding:14px 10px;text-align:center;border:1px solid #ECEDF1;border-radius:12px;background:#FFFFFF;">
      <div style="font-size:24px;font-weight:600;color:#1B2236;line-height:1;">${n}</div>
      <div style="margin-top:6px;font-size:12px;color:#5B6070;">${label}</div>
    </td>`

  const fupRows = d.openFollowups
    .map(
      (f) => `
      <tr><td style="padding:12px 0;border-top:1px solid #ECEDF1;">
        <a href="${accountUrl}/calls/${f.call_id}" style="text-decoration:none;color:#1B2236;">
          ${f.priority === 'urgent' ? '<span style="background:#FDECEC;color:#A12B2B;font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;text-transform:uppercase;">Urgent</span> ' : ''}
          <strong>${who(f.call)}</strong><br>
          <span style="font-size:13px;color:#4A5061;">${esc(REASON_LABELS[f.reason])}${f.call?.treatment_interest ? ` · ${esc(f.call.treatment_interest)}` : ''} · waiting ${esc(timeAgo(f.created_at).replace(' ago', ''))}</span>
        </a>
      </td></tr>`,
    )
    .join('')

  const notable = d.calls.filter((c) => c.outcome && [...BOOKED, ...PERSON].includes(c.outcome)).slice(0, 10)
  const notableRows = notable
    .map(
      (c) => `
      <tr><td style="padding:10px 0;border-top:1px solid #ECEDF1;">
        <a href="${accountUrl}/calls/${c.id}" style="text-decoration:none;color:#1B2236;">
          <span style="font-size:13px;color:#5B6070;">${esc(formatTime(c.started_at, tz))}</span> · <strong>${who(c)}</strong>
          · <span style="font-size:13px;">${esc(c.outcome ? OUTCOME_LABELS[c.outcome] : '')}</span><br>
          <span style="font-size:13px;color:#4A5061;">${esc((c.summary ?? '').slice(0, 160))}</span>
        </a>
      </td></tr>`,
    )
    .join('')

  const quiet = d.counts.total === 0
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(digestSubject(d))}</title></head>
<body style="margin:0;padding:0;background:#F6F7F9;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1B2236;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F7F9;padding:28px 14px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
  <tr><td style="padding:0 4px 16px;font-size:14px;font-weight:600;">
    <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#3355D6;vertical-align:-2px;"></span>&nbsp; Voix <span style="font-weight:400;color:#5B6070;">· ${esc(d.account.name)}</span>
  </td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid #ECEDF1;border-radius:18px;padding:26px 24px;">
    <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5B6070;">Yesterday · ${esc(d.dayLabel)}</div>
    <h1 style="margin:8px 0 18px;font-family:Georgia,serif;font-weight:400;font-size:28px;line-height:1.2;">
      ${quiet ? 'A quiet day — no calls came in.' : `Voix answered ${d.counts.total} call${d.counts.total === 1 ? '' : 's'}.`}
    </h1>
    ${
      quiet
        ? ''
        : `<table role="presentation" width="100%" cellspacing="6" cellpadding="0" style="margin:0 -6px;"><tr>
      ${stat(d.counts.booked, 'Booked or moved')}${stat(d.counts.questions, 'Questions answered')}${stat(d.counts.person, 'Needed a person')}
    </tr></table>`
    }

    <h2 style="margin:26px 0 4px;font-size:16px;">
      ${d.openTotal ? `${d.openTotal} follow-up${d.openTotal === 1 ? '' : 's'} waiting${d.urgentOpen ? ` · <span style="color:#A12B2B;">${d.urgentOpen} urgent</span>` : ''}` : 'No follow-ups waiting. All caught up.'}
    </h2>
    ${d.openTotal ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${fupRows}</table>` : ''}
    ${d.openTotal > d.openFollowups.length ? `<p style="margin:8px 0 0;font-size:13px;color:#5B6070;">+ ${d.openTotal - d.openFollowups.length} more in the dashboard</p>` : ''}

    ${notable.length ? `<h2 style="margin:26px 0 4px;font-size:16px;">Calls worth a look</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${notableRows}</table>` : ''}

    <div style="margin-top:26px;">
      <a href="${d.openTotal ? `${accountUrl}/followups` : `${accountUrl}/calls`}" style="display:inline-block;background:#1B2236;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:13px 22px;border-radius:999px;">
        ${d.openTotal ? 'Open follow-ups' : 'See all calls'}
      </a>
    </div>
  </td></tr>
  <tr><td style="padding:16px 6px;font-size:12px;color:#5B6070;line-height:1.6;">
    You get this every morning because you're on the alert list for ${esc(d.account.name)}. Reply to this email to change who receives it.
  </td></tr>
</table></td></tr></table></body></html>`
}

export function digestText(d: DigestData, appUrl: string): string {
  const url = `${appUrl.replace(/\/$/, '')}/voix/app/${d.account.id}/followups`
  return [
    `Voix daily — ${d.account.name} — ${d.dayLabel}`,
    `${d.counts.total} calls · ${d.counts.booked} booked or moved · ${d.counts.questions} questions answered · ${d.counts.person} needed a person`,
    `${d.openTotal} follow-ups waiting${d.urgentOpen ? ` (${d.urgentOpen} urgent)` : ''}`,
    ...d.openFollowups.map(
      (f) => `- ${f.call?.caller_name || formatPhone(f.call?.from_number)}: ${REASON_LABELS[f.reason]}${f.priority === 'urgent' ? ' (URGENT)' : ''}`,
    ),
    '',
    url,
  ].join('\n')
}

export async function digestRecipients(supabase: SupabaseClient, account: Pick<VoixAccount, 'id' | 'alert_emails'>) {
  const explicit = (account.alert_emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (explicit.length) return explicit
  const { data } = await supabase.from('voix_members').select('email').eq('account_id', account.id).eq('role', 'owner')
  return (data ?? []).map((m) => m.email as string)
}

/**
 * Build and send one digest. Scheduled sends claim the (account, local date)
 * log row first so a retry or overlapping cron run can't send twice.
 */
export async function sendDigest(
  supabase: SupabaseClient,
  account: Pick<VoixAccount, 'id' | 'name' | 'timezone' | 'alert_emails'>,
  opts: { test: boolean; to?: string[]; now?: Date },
): Promise<{ sent: boolean; recipients: number; reason?: string }> {
  const resend = getResendClient()
  if (!resend) return { sent: false, recipients: 0, reason: 'RESEND_API_KEY is not set' }

  const to = opts.to?.length ? opts.to : await digestRecipients(supabase, account)
  if (!to.length) return { sent: false, recipients: 0, reason: 'No owners or alert emails on this spa' }

  const data = await buildDigest(supabase, account, { includeSamples: opts.test, now: opts.now })

  let logId: string | null = null
  const { data: logRow, error: logErr } = await supabase
    .from('voix_digest_log')
    .insert({
      account_id: account.id,
      digest_date: data.digestDate,
      recipients: to.length,
      calls: data.counts.total,
      open_followups: data.openTotal,
      is_test: opts.test,
    })
    .select('id')
    .single()
  if (logErr) {
    if (logErr.code === '23505') return { sent: false, recipients: 0, reason: 'Already sent today' }
    throw new Error(`digest log: ${logErr.message}`)
  }
  logId = logRow.id as string

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.agent7even.ai'
  try {
    const { error } = await resend.emails.send({
      from: transactionalFromAddress(),
      to,
      subject: (opts.test ? '[Test] ' : '') + digestSubject(data),
      html: digestHtml(data, appUrl),
      text: digestText(data, appUrl),
    })
    if (error) throw new Error(error.message)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Keep the row (with the error) for scheduled sends so the monitor shows it.
    await supabase.from('voix_digest_log').update({ error: message.slice(0, 500) }).eq('id', logId)
    throw err
  }
  return { sent: true, recipients: to.length }
}
