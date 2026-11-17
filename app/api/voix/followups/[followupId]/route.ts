import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getVoixApiContext } from '@/lib/voix/access'
import { cleanNote, logFollowupEvent } from '@/lib/voix/followups'
import { snoozeUntil } from '@/lib/voix/format'
import {
  DONE_REASONS,
  DONE_REASON_LABELS,
  SNOOZE_LABELS,
  SNOOZE_PRESETS,
  type VoixDoneReason,
  type VoixSnoozePreset,
} from '@/lib/voix/types'

type Body = {
  action?: 'done' | 'reopen' | 'snooze' | 'assign' | 'called' | 'note'
  doneReason?: string
  preset?: string
  memberId?: string | null
  note?: string
}

export async function PATCH(req: Request, { params }: { params: Promise<{ followupId: string }> }) {
  const { followupId } = await params
  const body = (await req.json().catch(() => null)) as Body | null
  if (!body?.action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

  // Look up the follow-up's account first, then check the viewer can act in it.
  const { data: fup } = await createServiceClient()
    .from('voix_followups')
    .select('id, account_id, status')
    .eq('id', followupId)
    .maybeSingle()
  if (!fup) return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 })

  const res = await getVoixApiContext(fup.account_id as string)
  if ('status' in res) return NextResponse.json({ error: 'Not allowed' }, { status: res.status })
  const { ctx } = res
  const now = new Date().toISOString()
  const note = cleanNote(body.note)

  const update = async (patch: Record<string, unknown>) => {
    const { error } = await ctx.supabase
      .from('voix_followups')
      .update({ ...patch, updated_at: now })
      .eq('id', fup.id)
      .eq('account_id', ctx.account.id)
    if (error) throw new Error(error.message)
  }

  try {
    switch (body.action) {
      case 'done': {
        const reason: VoixDoneReason = (DONE_REASONS as readonly string[]).includes(body.doneReason ?? '')
          ? (body.doneReason as VoixDoneReason)
          : 'resolved'
        await update({
          status: 'done',
          done_reason: reason,
          done_at: now,
          done_by_member_id: ctx.member?.id ?? null,
          snoozed_until: null,
        })
        await logFollowupEvent(ctx, fup.id, 'done', [DONE_REASON_LABELS[reason], note].filter(Boolean).join(' — '))
        break
      }
      case 'reopen': {
        await update({ status: 'open', done_reason: null, done_at: null, done_by_member_id: null, snoozed_until: null })
        await logFollowupEvent(ctx, fup.id, 'reopened', note)
        break
      }
      case 'snooze': {
        const preset = (SNOOZE_PRESETS as readonly string[]).includes(body.preset ?? '')
          ? (body.preset as VoixSnoozePreset)
          : 'tomorrow_9am'
        await update({ status: 'snoozed', snoozed_until: snoozeUntil(preset, ctx.account.timezone).toISOString() })
        await logFollowupEvent(ctx, fup.id, 'snoozed', SNOOZE_LABELS[preset])
        break
      }
      case 'assign': {
        let label = 'Unassigned'
        if (body.memberId) {
          const { data: m } = await ctx.supabase
            .from('voix_members')
            .select('id, full_name, email')
            .eq('id', body.memberId)
            .eq('account_id', ctx.account.id)
            .maybeSingle()
          if (!m) return NextResponse.json({ error: 'Unknown team member' }, { status: 400 })
          label = `Assigned to ${m.full_name || m.email}`
        }
        await update({ assigned_member_id: body.memberId || null })
        await logFollowupEvent(ctx, fup.id, 'assigned', label)
        break
      }
      case 'called': {
        await update({})
        await logFollowupEvent(ctx, fup.id, 'called', note ?? 'Called the client back')
        break
      }
      case 'note': {
        if (!note) return NextResponse.json({ error: 'Note is empty' }, { status: 400 })
        await update({})
        await logFollowupEvent(ctx, fup.id, 'note', note)
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[voix/followups] update failed:', err)
    return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
