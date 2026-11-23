import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyRetellSignature, type RetellCall } from '@/lib/voix/retell'
import { openSlots, parseWeekday, slotLabel, spread, toE164, type BookingWindows } from '@/lib/voix/appointments'
import { decideRescheduleFollowUp, RESCHEDULE_NO_CHOICE, RESCHEDULE_OTHER_TIME } from '@/lib/voix/reschedule'

export const runtime = 'nodejs'

type Body = { name?: string; call?: RetellCall; args?: Record<string, unknown> }

function say(text: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ result: text, ...extra })
}

function str(v: unknown, max = 200): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

type OrigAppt = {
  id: string
  caller_name: string | null
  caller_phone: string | null
  service: string | null
  notes: string | null
  duration_min: number | null
  alternatives: unknown
  status: string
  reschedule_status: string | null
  callback_error: string | null
}

/**
 * Retell custom functions for Voix agents (POST, full payload, not args-only):
 * - check_availability { weekday?, time_of_day? } → open times to offer
 * - request_appointment { slot_iso, caller_name, service, notes? } → pending appointment
 * - choose_offered_time { slot_iso } → confirm a time the team already offered
 */
export async function POST(req: Request) {
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  const raw = await req.text()
  if (!verifyRetellSignature(raw, req.headers.get('x-retell-signature'), apiKey)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  let body: Body
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const args = body.args ?? {}
  const agentId = body.call?.agent_id
  if (!agentId) return say('I could not look up the schedule. Offer to have the team call back.')

  const supabase = createServiceClient()
  const { data: account } = await supabase
    .from('voix_accounts')
    .select('id, name, timezone, booking_windows, slot_minutes')
    .contains('retell_agent_ids', [agentId])
    .maybeSingle()
  if (!account) return say('This spa has no online schedule. Take their details and say the team will call back.')
  const acct = { ...account, booking_windows: (account.booking_windows ?? {}) as BookingWindows, slot_minutes: Number(account.slot_minutes) || 30 }
  const tz = acct.timezone || 'America/Los_Angeles'
  if (!Object.keys(acct.booking_windows).length) {
    return say('This spa has no booking windows set. Take their details and say the team will call back to schedule.')
  }

  if (body.name === 'check_availability') {
    const weekday = parseWeekday(args.weekday, tz)
    const tod = str(args.time_of_day)?.toLowerCase()
    const timeOfDay = tod === 'morning' || tod === 'afternoon' || tod === 'evening' ? tod : null
    const slots = await openSlots(supabase, acct, { weekday, timeOfDay })
    const pick = weekday != null ? slots.slice(0, 4) : spread(slots, 4, tz)
    if (!pick.length) {
      const any = spread(await openSlots(supabase, acct), 3, tz)
      if (!any.length) return say('No open times in the next two weeks. Take their details; the team will call back.')
      return say(
        `Nothing open then. Closest open times: ${any.map((s) => s.label).join('; ')}. Offer these.`,
        { slots: any },
      )
    }
    return say(`Open times: ${pick.map((s) => s.label).join('; ')}. Offer two or three of these. Use slot_iso from "slots" when requesting.`, { slots: pick })
  }

  if (body.name === 'request_appointment') {
    const iso = str(args.slot_iso, 40)
    const when = iso ? new Date(iso) : null
    if (!when || Number.isNaN(when.getTime())) return say('That time is not valid. Check availability again and offer open times.')
    const dyn = body.call?.retell_llm_dynamic_variables ?? {}
    const fromAppt = dyn.call_purpose === 'reschedule' ? str(dyn.appointment_id, 40) : null
    if (fromAppt) return followUpOnReschedule(supabase, acct, tz, body, fromAppt, when, true)

    const open = await openSlots(supabase, acct, { leadMinutes: 60 })
    if (!open.some((s) => new Date(s.iso).getTime() === when.getTime())) {
      return say('That time is no longer open. Check availability again and offer other times.')
    }
    // On our outbound calls the client is the callee, not the caller.
    const clientNumber = body.call?.direction === 'outbound' ? body.call?.to_number : body.call?.from_number
    const callerPhone = toE164(str(args.callback_number, 30)) ?? toE164(clientNumber)
    const { error } = await supabase.from('voix_appointments').insert({
      account_id: acct.id,
      retell_call_id: body.call?.call_id ?? null,
      caller_name: str(args.caller_name, 80),
      caller_phone: callerPhone,
      service: str(args.service, 80),
      notes: str(args.notes, 500),
      start_at: when.toISOString(),
      duration_min: acct.slot_minutes,
    })
    if (error) {
      console.error('[voix/tools] insert failed:', error.message)
      return say('Saving did not work. Take their details and say the team will call back to confirm.')
    }
    const label = slotLabel(when.toISOString(), tz)
    return say(
      `Pending appointment saved for ${label}. Tell the caller: "I've put you down for ${label}. The team will confirm shortly, and you'll get a quick call back to confirm." It is not confirmed yet.`,
    )
  }

  if (body.name === 'choose_offered_time') {
    const dyn = body.call?.retell_llm_dynamic_variables ?? {}
    const apptId = str(dyn.appointment_id, 40)
    const iso = str(args.slot_iso, 40)
    const when = iso ? new Date(iso) : null
    if (!apptId || !when || Number.isNaN(when.getTime())) return say('Could not find the offered times. Offer to have the team call back.')
    return followUpOnReschedule(supabase, acct, tz, body, apptId, when, false)
  }

  return say('Unknown function.')
}

/** Book one offered time, or save one different time, and never both. */
async function followUpOnReschedule(
  supabase: SupabaseClient,
  acct: { id: string; timezone: string; booking_windows: BookingWindows; slot_minutes: number },
  tz: string,
  body: Body,
  apptId: string,
  when: Date,
  allowOther: boolean,
) {
  const { data: orig } = await supabase
    .from('voix_appointments')
    .select('id, caller_name, caller_phone, service, notes, duration_min, alternatives, status, reschedule_status, callback_error')
    .eq('id', apptId)
    .eq('account_id', acct.id)
    .maybeSingle()
  if (!orig) return say('Could not find that appointment. Offer to have the team call back.')
  const row = orig as OrigAppt
  const decision = decideRescheduleFollowUp({
    rescheduleStatus: row.reschedule_status,
    callbackError: row.callback_error,
    requestedIso: when.toISOString(),
    alternatives: row.alternatives,
  })
  if (decision === 'already_settled') return say(await alreadySaved(supabase, acct.id, row.id, tz))
  // choose_offered_time only confirms a time the team listed. A different time stays a request.
  if (decision === 'request_other' && !allowOther) {
    return say('That is not one of the times the team offered. Repeat the offered times.')
  }

  const leadMinutes = decision === 'book_offered' ? 30 : 60
  const open = await openSlots(supabase, acct, { leadMinutes })
  if (!open.some((s) => new Date(s.iso).getTime() === when.getTime())) {
    return say(decision === 'book_offered'
      ? 'That time was just taken. Offer the other times the team offered, or check availability.'
      : 'That time is no longer open. Check availability again and offer other times.')
  }

  const claim = decision === 'book_offered'
    ? { reschedule_status: 'rescheduled', callback_error: null }
    : { reschedule_status: 'callback_needed', callback_error: RESCHEDULE_OTHER_TIME }
  const claimed = await claimOffer(supabase, row.id, acct.id, claim)
  if (!claimed) return say(await alreadySaved(supabase, acct.id, row.id, tz))

  const { error } = await supabase.from('voix_appointments').insert(decision === 'book_offered'
    ? {
        account_id: acct.id,
        retell_call_id: body.call?.call_id ?? null,
        caller_name: row.caller_name,
        caller_phone: row.caller_phone,
        service: row.service,
        notes: row.notes,
        start_at: when.toISOString(),
        duration_min: row.duration_min,
        status: 'confirmed',
        decided_at: new Date().toISOString(),
        decided_by_label: 'Client, from times the team offered',
        callback_status: 'skipped',
        rescheduled_from: row.id,
      }
    : {
        rescheduled_from: row.id,
        account_id: acct.id,
        retell_call_id: body.call?.call_id ?? null,
        caller_name: row.caller_name ?? str(body.args?.caller_name, 80),
        caller_phone: row.caller_phone ?? clientPhone(body),
        service: row.service ?? str(body.args?.service, 80),
        notes: str(body.args?.notes, 500) ?? row.notes,
        start_at: when.toISOString(),
        duration_min: acct.slot_minutes,
      })
  if (error) {
    console.error('[voix/tools] reschedule insert failed:', error.message)
    await releaseOffer(supabase, row.id, acct.id, decision === 'book_offered' ? 'rescheduled' : 'callback_needed')
    return say('Saving did not work. Say the team will call back to confirm.')
  }
  const label = slotLabel(when.toISOString(), tz)
  if (decision === 'book_offered') {
    return say(`Booked and confirmed for ${label}; the team already approved this time. Tell the client: "You're all set for ${label}."`)
  }
  return say(
    `Pending appointment saved for ${label}. Tell the caller: "I've put you down for ${label}. The team will confirm shortly, and you'll get a quick call back to confirm." It is not confirmed yet.`,
  )
}

/** Take the offer so a second tool call in the same conversation cannot book again. */
async function claimOffer(
  supabase: SupabaseClient,
  id: string,
  accountId: string,
  patch: { reschedule_status: string; callback_error?: string | null },
): Promise<boolean> {
  if (await takeOffer(supabase, id, accountId, patch, 'offered')) return true
  // call_ended can mark "no choice" while this tool is still saving the time
  // the client just picked. That note is not a finished reschedule.
  return takeOffer(supabase, id, accountId, patch, 'no_choice')
}

async function takeOffer(
  supabase: SupabaseClient,
  id: string,
  accountId: string,
  patch: { reschedule_status: string; callback_error?: string | null },
  which: 'offered' | 'no_choice',
): Promise<boolean> {
  let query = supabase
    .from('voix_appointments')
    .update(patch)
    .eq('id', id)
    .eq('account_id', accountId)
  query = which === 'offered'
    ? query.eq('reschedule_status', 'offered')
    : query.eq('reschedule_status', 'callback_needed').eq('callback_error', RESCHEDULE_NO_CHOICE)
  const { data, error } = await query.select('id').maybeSingle()
  if (error) {
    console.error('[voix/tools] reschedule claim failed:', error.message)
    return false
  }
  return Boolean(data)
}

/** Put an offer back only if this call still holds the claim and nothing was saved. */
async function releaseOffer(supabase: SupabaseClient, id: string, accountId: string, held: string) {
  let query = supabase
    .from('voix_appointments')
    .update(held === 'callback_needed'
      ? { reschedule_status: 'offered', callback_error: null }
      : { reschedule_status: 'offered' })
    .eq('id', id)
    .eq('account_id', accountId)
    .eq('reschedule_status', held)
  if (held === 'callback_needed') query = query.eq('callback_error', RESCHEDULE_OTHER_TIME)
  const { error } = await query
  if (error) console.error('[voix/tools] reschedule release failed:', error.message)
}

function clientPhone(body: Body): string | null {
  const clientNumber = body.call?.direction === 'outbound' ? body.call?.to_number : body.call?.from_number
  return toE164(str(body.args?.callback_number, 30)) ?? toE164(clientNumber)
}

async function alreadySaved(supabase: SupabaseClient, accountId: string, fromId: string, tz: string) {
  const { data: child } = await supabase
    .from('voix_appointments')
    .select('start_at, status')
    .eq('account_id', accountId)
    .eq('rescheduled_from', fromId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!child?.start_at) return 'That appointment was already handled. Offer to have the team call back.'
  const label = slotLabel(child.start_at as string, tz)
  if (child.status === 'confirmed') return `Already booked for ${label}. Tell the client that time is set. Do not book another.`
  return `Already requested for ${label}. Tell the client the team will confirm shortly. Do not book another.`
}
