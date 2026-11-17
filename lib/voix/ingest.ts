import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'
import { mapRetellCall, type FollowupSignal, type RetellCall, type RetellEvent } from '@/lib/voix/retell'
import { formatPhone } from '@/lib/voix/format'
import { REASON_LABELS, type VoixFollowupReason, type VoixOutcome } from '@/lib/voix/types'
import { followupReasonFor } from '@/lib/voix/followupReason'

const STATUS_RANK = { ongoing: 0, ended: 1, analyzed: 2 } as const
type CallStatus = keyof typeof STATUS_RANK

export type IngestResult =
  | { ok: true; ignored: string }
  | { ok: true; callId: string; followupCreated: boolean }

/** Store one Retell webhook event. Safe to receive twice or out of order. */
export async function ingestRetellEvent(
  supabase: SupabaseClient,
  event: RetellEvent,
  call: RetellCall,
): Promise<IngestResult> {
  if (!['call_started', 'call_ended', 'call_analyzed'].includes(event)) return { ok: true, ignored: `event ${event}` }
  if (!call?.call_id) return { ok: true, ignored: 'no call_id' }
  if (!call.agent_id) return { ok: true, ignored: 'no agent_id' }

  const { data: account } = await supabase
    .from('voix_accounts')
    .select('id, name, alert_emails')
    .contains('retell_agent_ids', [call.agent_id])
    .limit(1)
    .maybeSingle()
  if (!account) return { ok: true, ignored: `no account for agent ${call.agent_id}` }

  const incoming: CallStatus = event === 'call_started' ? 'ongoing' : event === 'call_ended' ? 'ended' : 'analyzed'
  const { row, followup } = mapRetellCall(call, incoming === 'analyzed')

  const { data: existing } = await supabase
    .from('voix_calls')
    .select('id, status')
    .eq('retell_call_id', row.retell_call_id)
    .maybeSingle()

  const current = (existing?.status as CallStatus | undefined) ?? null
  const status: CallStatus = current && STATUS_RANK[current] > STATUS_RANK[incoming] ? current : incoming

  // Never let a late "started"/"ended" wipe fields an earlier event already wrote.
  const patch: Record<string, unknown> = { account_id: account.id, status, updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && v !== undefined) patch[k] = v
  }

  const { data: saved, error } = await supabase
    .from('voix_calls')
    .upsert(patch, { onConflict: 'retell_call_id' })
    .select('id, from_number, caller_name, summary, outcome, urgent')
    .single()
  if (error || !saved) throw new Error(`voix_calls upsert failed: ${error?.message ?? 'no row'}`)

  let followupCreated = false
  if (incoming === 'analyzed' && followup.needed) {
    followupCreated = await createFollowupIfMissing(supabase, account, saved, followup)
  }
  return { ok: true, callId: saved.id, followupCreated }
}

async function createFollowupIfMissing(
  supabase: SupabaseClient,
  account: { id: string; name: string; alert_emails: string[] | null },
  call: { id: string; from_number: string | null; caller_name: string | null; summary: string | null; outcome: VoixOutcome | null; urgent: boolean },
  signal: FollowupSignal,
): Promise<boolean> {
  const reason = followupReasonFor(call.outcome, call.urgent, signal.reasonText)
  const priority = call.urgent || reason === 'clinical' || reason === 'complaint' ? 'urgent' : 'normal'

  const { data: inserted, error } = await supabase
    .from('voix_followups')
    .upsert(
      { account_id: account.id, call_id: call.id, reason, priority, status: 'open' },
      { onConflict: 'call_id', ignoreDuplicates: true },
    )
    .select('id')
  if (error) throw new Error(`voix_followups insert failed: ${error.message}`)
  const followupId = inserted?.[0]?.id as string | undefined
  if (!followupId) return false // already existed

  await supabase.from('voix_followup_events').insert({
    followup_id: followupId,
    account_id: account.id,
    type: 'created',
    actor_label: 'Voix',
    body: signal.reasonText,
  })

  await sendFollowupAlert(supabase, account, call, { reason, priority, reasonText: signal.reasonText }).catch((err) =>
    console.error('[voix/ingest] alert email failed:', err),
  )
  return true
}

async function alertRecipients(supabase: SupabaseClient, account: { id: string; alert_emails: string[] | null }) {
  const explicit = (account.alert_emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (explicit.length) return explicit
  const { data } = await supabase.from('voix_members').select('email').eq('account_id', account.id).eq('role', 'owner')
  return (data ?? []).map((m) => m.email as string)
}

async function sendFollowupAlert(
  supabase: SupabaseClient,
  account: { id: string; name: string; alert_emails: string[] | null },
  call: { id: string; from_number: string | null; caller_name: string | null; summary: string | null },
  info: { reason: VoixFollowupReason; priority: 'urgent' | 'normal'; reasonText: string | null },
) {
  const to = await alertRecipients(supabase, account)
  if (!to.length) return
  const who = call.caller_name ? `${call.caller_name} (${formatPhone(call.from_number)})` : formatPhone(call.from_number)
  const label = REASON_LABELS[info.reason]
  const urgent = info.priority === 'urgent'
  await sendTransactionalEmail({
    to,
    subject: `${urgent ? 'Urgent: ' : ''}${label} — ${who}`,
    title: `${urgent ? 'Urgent follow-up' : 'New follow-up'} for ${account.name}`,
    body: [`${label}: ${who}.`, info.reasonText, call.summary].filter(Boolean).join(' '),
    link: `/voix/app/${account.id}/calls/${call.id}`,
    ctaLabel: 'Open the call →',
  })
}
