import { NextResponse } from 'next/server'
import { actorLabel, getVoixApiContext } from '@/lib/voix/access'
import { placeConfirmationCall, slotLabel, toE164 } from '@/lib/voix/appointments'

export const runtime = 'nodejs'

/** Confirm or decline a pending appointment. Confirming places the Retell callback. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    accountId?: string
    id?: string
    action?: 'confirm' | 'decline'
    callback?: boolean
  } | null
  if (!body?.accountId || !body.id || !['confirm', 'decline'].includes(body.action ?? '')) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  const res = await getVoixApiContext(body.accountId)
  if ('status' in res) return NextResponse.json({ error: 'Not allowed' }, { status: res.status })
  const { ctx } = res

  const { data: appt } = await ctx.supabase
    .from('voix_appointments')
    .select('id, status, caller_name, caller_phone, service, start_at')
    .eq('id', body.id)
    .eq('account_id', ctx.account.id)
    .maybeSingle()
  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (appt.status !== 'pending') return NextResponse.json({ error: 'Already decided' }, { status: 409 })

  const decided = {
    decided_at: new Date().toISOString(),
    decided_by_member_id: ctx.member?.id ?? null,
    decided_by_label: actorLabel(ctx),
    updated_at: new Date().toISOString(),
  }

  if (body.action === 'decline') {
    await ctx.supabase.from('voix_appointments').update({ status: 'declined', ...decided }).eq('id', appt.id)
    return NextResponse.json({ ok: true })
  }

  await ctx.supabase.from('voix_appointments').update({ status: 'confirmed', ...decided }).eq('id', appt.id)

  const to = toE164(appt.caller_phone)
  const from = toE164(ctx.account.phone_number)
  const agentId = ctx.account.retell_agent_ids[0]
  if (body.callback === false || !to || !from || !agentId) {
    const why = body.callback === false ? 'Callback turned off' : !to ? 'No client number' : !from ? 'Spa has no Voix number set' : 'No agent linked'
    await ctx.supabase.from('voix_appointments').update({ callback_status: 'skipped', callback_error: why }).eq('id', appt.id)
    return NextResponse.json({ ok: true, callback: 'skipped', reason: why })
  }

  try {
    const callId = await placeConfirmationCall({
      fromNumber: from,
      toNumber: to,
      agentId,
      spaName: ctx.account.name,
      callerName: appt.caller_name,
      service: appt.service,
      whenLabel: slotLabel(appt.start_at, ctx.account.timezone),
      appointmentId: appt.id,
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
