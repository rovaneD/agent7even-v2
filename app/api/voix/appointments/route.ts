import { NextResponse } from 'next/server'
import { actorLabel, getVoixApiContext } from '@/lib/voix/access'
import {
  openSlots, placeConfirmationCall, placeRescheduleCall, slotLabel, toE164, type BookingWindows, type Slot,
} from '@/lib/voix/appointments'

export const runtime = 'nodejs'

const DEMO_NOTE = 'Demo: confirming calls your phone'

/** Open times the team can offer instead (GET ?accountId=…). */
export async function GET(req: Request) {
  const accountId = new URL(req.url).searchParams.get('accountId')
  if (!accountId) return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
  const res = await getVoixApiContext(accountId)
  if ('status' in res) return NextResponse.json({ error: 'Not allowed' }, { status: res.status })
  const { ctx } = res
  const { data: cfg } = await ctx.supabase.from('voix_accounts').select('booking_windows, slot_minutes').eq('id', ctx.account.id).maybeSingle()
  const slots = await openSlots(ctx.supabase, {
    id: ctx.account.id,
    timezone: ctx.account.timezone,
    booking_windows: (cfg?.booking_windows ?? {}) as BookingWindows,
    slot_minutes: Number(cfg?.slot_minutes) || 30,
  }, { days: 10, leadMinutes: 180 })
  return NextResponse.json({ slots })
}

/** Confirm, decline (optionally offering other times), or reset the demo. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    accountId?: string
    id?: string
    action?: 'confirm' | 'decline' | 'reschedule' | 'reset_demo'
    callback?: boolean
    alternatives?: string[]
  } | null
  if (!body?.accountId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const res = await getVoixApiContext(body.accountId)
  if ('status' in res) return NextResponse.json({ error: 'Not allowed' }, { status: res.status })
  const { ctx } = res

  // Admin only: put the demo appointments back to "needs confirmation", moved into the future.
  if (body.action === 'reset_demo') {
    if (!ctx.viewer.isAdmin) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    const { data: demos } = await ctx.supabase
      .from('voix_appointments')
      .select('id, start_at')
      .eq('account_id', ctx.account.id)
      .eq('notes', DEMO_NOTE)
    const ids = (demos ?? []).map((d) => d.id as string)
    if (ids.length) await ctx.supabase.from('voix_appointments').delete().in('rescheduled_from', ids)
    const week = 7 * 86_400_000
    const soon = Date.now() + 86_400_000
    for (const d of demos ?? []) {
      let t = new Date(d.start_at as string).getTime()
      while (t < soon) t += week
      await ctx.supabase
        .from('voix_appointments')
        .update({
          status: 'pending', start_at: new Date(t).toISOString(), decided_at: null, decided_by_member_id: null,
          decided_by_label: null, callback_status: 'none', callback_call_id: null, callback_error: null,
          alternatives: [], reschedule_status: 'none', updated_at: new Date().toISOString(),
        })
        .eq('id', d.id)
    }
    // Sample (already confirmed) appointments: undo any demo reschedules.
    await ctx.supabase.from('voix_appointments').delete()
      .eq('account_id', ctx.account.id).eq('notes', 'Sample appointment').not('rescheduled_from', 'is', null)
    await ctx.supabase.from('voix_appointments')
      .update({ status: 'confirmed', alternatives: [], reschedule_status: 'none', callback_status: 'none', callback_call_id: null, callback_error: null })
      .eq('account_id', ctx.account.id).eq('notes', 'Sample appointment').eq('status', 'cancelled')
    return NextResponse.json({ ok: true, reset: ids.length })
  }

  if (!body.id || !['confirm', 'decline', 'reschedule'].includes(body.action ?? '')) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: appt } = await ctx.supabase
    .from('voix_appointments')
    .select('id, status, caller_name, caller_phone, service, start_at')
    .eq('id', body.id)
    .eq('account_id', ctx.account.id)
    .maybeSingle()
  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const moving = body.action === 'reschedule'
  if (moving ? appt.status !== 'confirmed' : appt.status !== 'pending') {
    return NextResponse.json({ error: moving ? 'Only confirmed appointments can be rescheduled' : 'Already decided' }, { status: 409 })
  }

  const decided = {
    decided_at: new Date().toISOString(),
    decided_by_member_id: ctx.member?.id ?? null,
    decided_by_label: actorLabel(ctx),
    updated_at: new Date().toISOString(),
  }
  const tz = ctx.account.timezone
  const to = toE164(appt.caller_phone)
  const from = toE164(ctx.account.phone_number)
  const agentId = ctx.account.retell_agent_ids[0]
  const cannotCall = !to ? 'No client number' : !from ? 'Spa has no Voix number set' : !agentId ? 'No agent linked' : null

  if (body.action === 'decline' || moving) {
    // Only accept offered times that are real open slots right now.
    const { data: cfg } = await ctx.supabase.from('voix_accounts').select('booking_windows, slot_minutes').eq('id', ctx.account.id).maybeSingle()
    const open = await openSlots(ctx.supabase, {
      id: ctx.account.id, timezone: tz,
      booking_windows: (cfg?.booking_windows ?? {}) as BookingWindows,
      slot_minutes: Number(cfg?.slot_minutes) || 30,
    }, { days: 14, leadMinutes: 60 })
    const openSet = new Map(open.map((s) => [new Date(s.iso).getTime(), s]))
    const offered: Slot[] = (body.alternatives ?? [])
      .slice(0, 3)
      .map((iso) => openSet.get(new Date(iso).getTime()))
      .filter((s): s is Slot => !!s)

    const wantsCall = body.callback !== false
    // Claim the row before placing a call. A second click that lost the race must not
    // overwrite the offered times or dial the client again.
    const { data: saved, error: saveError } = await ctx.supabase.from('voix_appointments').update({
      status: moving ? 'cancelled' : 'declined', ...decided,
      alternatives: offered.map((s) => s.iso),
      reschedule_status: wantsCall ? 'offered' : 'none',
    }).eq('id', appt.id).eq('status', moving ? 'confirmed' : 'pending').select('id').maybeSingle()
    if (saveError) {
      console.error('[voix/appointments] decision save failed:', saveError.message)
      return NextResponse.json({ error: 'Could not save' }, { status: 500 })
    }
    if (!saved) {
      return NextResponse.json({ error: moving ? 'Only confirmed appointments can be rescheduled' : 'Already decided' }, { status: 409 })
    }

    if (!wantsCall || cannotCall) {
      const why = !wantsCall ? (moving ? 'Cancelled without a call' : 'Declined without a call') : cannotCall
      await ctx.supabase.from('voix_appointments').update({ callback_status: 'skipped', callback_error: why, reschedule_status: wantsCall ? 'callback_needed' : 'none' }).eq('id', appt.id)
      return NextResponse.json({ ok: true, callback: 'skipped', reason: why })
    }
    try {
      const callId = await placeRescheduleCall({
        fromNumber: from!, toNumber: to!, agentId,
        spaName: ctx.account.name, callerName: appt.caller_name, service: appt.service,
        originalLabel: slotLabel(appt.start_at, tz), alternatives: offered, appointmentId: appt.id,
        reason: moving ? 'moved' : 'declined',
      })
      await ctx.supabase.from('voix_appointments').update({ callback_status: 'placed', callback_call_id: callId }).eq('id', appt.id)
      return NextResponse.json({ ok: true, callback: 'placed' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[voix/appointments] reschedule call failed:', msg)
      await ctx.supabase.from('voix_appointments').update({ callback_status: 'failed', callback_error: msg.slice(0, 300), reschedule_status: 'callback_needed' }).eq('id', appt.id)
      return NextResponse.json({ ok: true, callback: 'failed', reason: msg })
    }
  }

  await ctx.supabase.from('voix_appointments').update({ status: 'confirmed', ...decided }).eq('id', appt.id)

  if (body.callback === false || cannotCall) {
    const why = body.callback === false ? 'Callback turned off' : cannotCall
    await ctx.supabase.from('voix_appointments').update({ callback_status: 'skipped', callback_error: why }).eq('id', appt.id)
    return NextResponse.json({ ok: true, callback: 'skipped', reason: why })
  }

  try {
    const callId = await placeConfirmationCall({
      fromNumber: from!, toNumber: to!, agentId,
      spaName: ctx.account.name, callerName: appt.caller_name, service: appt.service,
      whenLabel: slotLabel(appt.start_at, tz), appointmentId: appt.id,
    })
    await ctx.supabase.from('voix_appointments').update({ callback_status: 'placed', callback_call_id: callId }).eq('id', appt.id)
    return NextResponse.json({ ok: true, callback: 'placed' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[voix/appointments] callback failed:', msg)
    await ctx.supabase.from('voix_appointments').update({ callback_status: 'failed', callback_error: msg.slice(0, 300) }).eq('id', appt.id)
    return NextResponse.json({ ok: true, callback: 'failed', reason: msg })
  }
}
