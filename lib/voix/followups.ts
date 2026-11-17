import type { VoixAccountContext } from '@/lib/voix/access'
import { actorLabel } from '@/lib/voix/access'
import type { VoixFollowupEvent } from '@/lib/voix/types'

export async function logFollowupEvent(
  ctx: VoixAccountContext,
  followupId: string,
  type: VoixFollowupEvent['type'],
  body: string | null = null,
) {
  const { error } = await ctx.supabase.from('voix_followup_events').insert({
    followup_id: followupId,
    account_id: ctx.account.id,
    member_id: ctx.member?.id ?? null,
    actor_label: actorLabel(ctx),
    type,
    body,
  })
  if (error) throw new Error(`voix_followup_events insert failed: ${error.message}`)
}

export function cleanNote(value: unknown, max = 2000): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t ? t.slice(0, max) : null
}
