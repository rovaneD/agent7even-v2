import { NextResponse } from 'next/server'
import { getVoixApiContext } from '@/lib/voix/access'
import { cleanNote, logFollowupEvent } from '@/lib/voix/followups'
import { FOLLOWUP_REASONS, type VoixFollowupReason } from '@/lib/voix/types'

/** Create a follow-up for a call by hand (staff spotted something Voix didn't flag). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    accountId?: string
    callId?: string
    reason?: string
    note?: string
  } | null
  if (!body?.accountId || !body.callId) return NextResponse.json({ error: 'Missing accountId or callId' }, { status: 400 })

  const res = await getVoixApiContext(body.accountId)
  if ('status' in res) return NextResponse.json({ error: 'Not allowed' }, { status: res.status })
  const { ctx } = res

  const { data: call } = await ctx.supabase
    .from('voix_calls')
    .select('id, urgent')
    .eq('id', body.callId)
    .eq('account_id', ctx.account.id)
    .maybeSingle()
  if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

  const reason: VoixFollowupReason = (FOLLOWUP_REASONS as readonly string[]).includes(body.reason ?? '')
    ? (body.reason as VoixFollowupReason)
    : 'other'

  const { data: created, error } = await ctx.supabase
    .from('voix_followups')
    .upsert(
      {
        account_id: ctx.account.id,
        call_id: call.id,
        reason,
        priority: call.urgent || reason === 'clinical' || reason === 'complaint' ? 'urgent' : 'normal',
        status: 'open',
        assigned_member_id: ctx.member?.id ?? null,
      },
      { onConflict: 'call_id', ignoreDuplicates: true },
    )
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const id = created?.[0]?.id as string | undefined
  if (!id) return NextResponse.json({ error: 'This call already has a follow-up' }, { status: 409 })

  await logFollowupEvent(ctx, id, 'created', cleanNote(body.note))
  return NextResponse.json({ id })
}
