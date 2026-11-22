import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyRetellSignature, type RetellCall } from '@/lib/voix/retell'
import { openSlots, parseWeekday, slotLabel, spread, toE164, type BookingWindows } from '@/lib/voix/appointments'

export const runtime = 'nodejs'

type Body = { name?: string; call?: RetellCall; args?: Record<string, unknown> }

function say(text: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ result: text, ...extra })
}

function str(v: unknown, max = 200): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

/**
 * Retell custom functions for Voix agents (POST, full payload, not args-only):
 * - check_availability { weekday?, time_of_day? } → open times to offer
 * - request_appointment { slot_iso, caller_name, service, notes? } → pending appointment
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
    const open = await openSlots(supabase, acct, { leadMinutes: 60 })
    if (!open.some((s) => new Date(s.iso).getTime() === when.getTime())) {
      return say('That time is no longer open. Check availability again and offer other times.')
    }
    const dyn = body.call?.retell_llm_dynamic_variables ?? {}
    const fromAppt = dyn.call_purpose === 'reschedule' ? str(dyn.appointment_id, 40) : null
    // On our outbound calls the client is the callee, not the caller.
    const clientNumber = body.call?.direction === 'outbound' ? body.call?.to_number : body.call?.from_number
    const callerPhone = toE164(str(args.callback_number, 30)) ?? toE164(clientNumber)
    if (fromAppt) await supabase.from('voix_appointments').update({ reschedule_status: 'rescheduled' }).eq('id', fromAppt).eq('account_id', acct.id)
    const { error } = await supabase.from('voix_appointments').insert({
      rescheduled_from: fromAppt,
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
    if (!apptId || !iso) return say('Could not find the offered times. Offer to have the team call back.')
    const { data: orig } = await supabase
      .from('voix_appointments')
      .select('id, caller_name, caller_phone, service, notes, duration_min, alternatives, status')
      .eq('id', apptId)
      .eq('account_id', acct.id)
      .maybeSingle()
    if (!orig) return say('Could not find that appointment. Offer to have the team call back.')
    const offered = ((orig.alternatives as string[]) ?? []).map((a) => new Date(a).getTime())
    const when = new Date(iso)
    if (!offered.includes(when.getTime())) return say('That is not one of the times the team offered. Repeat the offered times.')
    const open = await openSlots(supabase, acct, { leadMinutes: 30 })
    if (!open.some((s) => new Date(s.iso).getTime() === when.getTime())) {
      return say('That time was just taken. Offer the other times the team offered, or check availability.')
    }
    const { error } = await supabase.from('voix_appointments').insert({
      account_id: acct.id,
      retell_call_id: body.call?.call_id ?? null,
      caller_name: orig.caller_name,
      caller_phone: orig.caller_phone,
      service: orig.service,
      notes: orig.notes,
      start_at: when.toISOString(),
      duration_min: orig.duration_min,
      status: 'confirmed',
      decided_at: new Date().toISOString(),
      decided_by_label: 'Client, from times the team offered',
      callback_status: 'skipped',
      rescheduled_from: orig.id,
    })
    if (error) {
      console.error('[voix/tools] reschedule insert failed:', error.message)
      return say('Saving did not work. Say the team will call back to confirm.')
    }
    await supabase.from('voix_appointments').update({ reschedule_status: 'rescheduled' }).eq('id', orig.id)
    const label = slotLabel(when.toISOString(), tz)
    return say(`Booked and confirmed for ${label}; the team already approved this time. Tell the client: "You're all set for ${label}."`)
  }

  return say('Unknown function.')
}
