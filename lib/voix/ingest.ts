import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'
import { mapRetellCall, type FollowupSignal, type RetellCall, type RetellEvent } from '@/lib/voix/retell'
import { formatPhone } from '@/lib/voix/format'
import { REASON_LABELS, type VoixFollowupReason, type VoixOutcome } from '@/lib/voix/types'
import { followupReasonFor } from '@/lib/voix/followupReason'
import { recordPilotRequest } from '@/lib/voix/pilotRequests'
import { callbackAppointmentUpdate, callbackKind, callbackResultNote } from '@/lib/voix/callbackResult'

const STATUS_RANK = { ongoing: 0, ended: 1, analyzed: 2 } as const
type CallStatus = keyof typeof STATUS_RANK

export type IngestResult =
  | { ok: true; ignored: string; accountId?: string }
  | { ok: true; sales: string }
  | { ok: true; callId: string; accountId: string; followupCreated: boolean }

/** Store one Retell webhook event. Safe to receive twice or out of order. */
export async function ingestRetellEvent(
  supabase: SupabaseClient,
  event: RetellEvent,
  call: RetellCall,
): Promise<IngestResult> {
  if (!['call_started', 'call_ended', 'call_analyzed'].includes(event)) return { ok: true, ignored: `event ${event}` }
  if (!call?.call_id) return { ok: true, ignored: 'no call_id' }
  if (!call.agent_id) return { ok: true, ignored: 'no agent_id' }

  if (salesAgentIds().includes(call.agent_id)) return ingestSalesCall(supabase, event, call)

  // Voix's own outbound callbacks (confirm / reschedule) are not calls the spa received:
  // keep them out of Calls, follow-ups and the daily recap; record the result on the appointment.
  if (call.direction === 'outbound') return ingestCallbackResult(supabase, event, call)

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
  return { ok: true, callId: saved.id, accountId: account.id, followupCreated }
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

async function ingestCallbackResult(supabase: SupabaseClient, event: RetellEvent, call: RetellCall): Promise<IngestResult> {
  const apptId = text(call.metadata?.voix_appointment_id, 40) ?? text(call.retell_llm_dynamic_variables?.appointment_id, 40)
  // call_ended carries disconnection_reason and omits call_analysis. A missed
  // call is decided here; call_analyzed is not a second chance to record it.
  if (!apptId || event !== 'call_ended') return { ok: true, ignored: `callback ${event}` }

  const { data: appt, error: readError } = await supabase
    .from('voix_appointments')
    .select('id, account_id, reschedule_status, callback_call_id')
    .eq('id', apptId)
    .maybeSingle()
  if (readError) throw new Error(`voix_appointments read failed: ${readError.message}`)
  if (!appt) return { ok: true, ignored: 'callback for unknown appointment' }

  const dyn = call.retell_llm_dynamic_variables ?? {}
  const kind = callbackKind({
    metadataKind: call.metadata?.kind,
    callPurpose: dyn.call_purpose,
    dynamicAppointmentId: dyn.appointment_id,
  })
  const decision = callbackAppointmentUpdate({
    kind,
    disconnectionReason: call.disconnection_reason,
    inVoicemail: call.call_analysis?.in_voicemail === true,
    rescheduleStatus: appt.reschedule_status as string | null,
    storedCallId: appt.callback_call_id as string | null,
    eventCallId: call.call_id,
  })
  if (!decision) {
    const missed = callbackResultNote(call.disconnection_reason, call.call_analysis?.in_voicemail === true)
    return {
      ok: true,
      ignored: missed ? 'callback not applied' : 'callback answered',
      accountId: appt.account_id as string,
    }
  }

  const patch: Record<string, unknown> = { ...decision, updated_at: new Date().toISOString() }
  let update = supabase.from('voix_appointments').update(patch).eq('id', appt.id).neq('reschedule_status', 'rescheduled')
  if (decision.reschedule_status) update = update.eq('reschedule_status', 'offered')
  else if (kind === 'confirmation') update = update.eq('reschedule_status', 'none')
  // Confirmation results only stick on the call id already stored (or not stored yet).
  // A reschedule call's id is often not stored yet, so it must not use that filter.
  if (kind !== 'reschedule' && call.call_id && /^[A-Za-z0-9_-]+$/.test(call.call_id)) {
    update = update.or(`callback_call_id.is.null,callback_call_id.eq.${call.call_id}`)
  }
  const { error } = await update
  if (error) throw new Error(`voix_appointments callback update failed: ${error.message}`)
  return { ok: true, ignored: `callback ${decision.callback_error}`, accountId: appt.account_id as string }
}

/** VOIX_SALES_AGENT_ID: Retell agent id(s) of Voix's own sales line, comma-separated. */
function salesAgentIds(): string[] {
  return (process.env.VOIX_SALES_AGENT_ID ?? '').split(',').map((v) => v.trim()).filter(Boolean)
}

function text(v: unknown, max = 200): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

/**
 * Calls to Voix's own line (the AI that explains the product). These are spa
 * owners, not patients: a finished call with interest becomes a pilot request.
 * Custom analysis fields on that agent: contact_name, spa_name, email,
 * callback_phone, instagram, booking_software, locations, preferred_time, wants_pilot.
 */
async function ingestSalesCall(supabase: SupabaseClient, event: RetellEvent, call: RetellCall): Promise<IngestResult> {
  if (event !== 'call_analyzed') return { ok: true, sales: `sales line ${event}` }
  const a = call.call_analysis ?? {}
  const c = (a.custom_analysis_data ?? {}) as Record<string, unknown>
  const wants = c.wants_pilot === true || String(c.wants_pilot).toLowerCase() === 'true'
  const spa = text(c.spa_name)
  if (!wants && !spa) return { ok: true, sales: 'sales line call, no pilot interest' }

  await recordPilotRequest(supabase, {
    source: 'phone',
    retell_call_id: call.call_id ?? null,
    contact_name: text(c.contact_name),
    spa_name: spa,
    email: text(c.email, 320),
    phone: text(c.callback_phone, 40) ?? text(call.from_number, 40),
    instagram: text(c.instagram, 120),
    booking_software: text(c.booking_software, 60),
    locations: text(c.locations, 40),
    preferred_time: text(c.preferred_time),
    notes: text(a.call_summary, 2000),
  })
  return { ok: true, sales: 'Pilot request saved from sales line' }
}
