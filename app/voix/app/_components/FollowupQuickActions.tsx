'use client'

import { DONE_REASONS, DONE_REASON_LABELS, SNOOZE_LABELS, SNOOZE_PRESETS } from '@/lib/voix/types'
import { BTN_DARK, BTN_LIGHT, Menu, useFollowupAction } from './followupClient'

export default function FollowupQuickActions({
  followupId,
  status,
  callerPhone,
}: {
  followupId: string
  status: 'open' | 'snoozed' | 'done'
  callerPhone: string | null
}) {
  const { busy, error, patch } = useFollowupAction()
  const tel = callerPhone ? `tel:${callerPhone.replace(/[^\d+]/g, '')}` : null

  if (status === 'done') {
    return (
      <button type="button" disabled={busy} onClick={() => void patch(followupId, { action: 'reopen' })} className={BTN_LIGHT}>
        Reopen
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tel ? (
        <a href={tel} onClick={() => void patch(followupId, { action: 'called' })} className={BTN_DARK}>
          Call back
        </a>
      ) : null}
      <Menu
        label="Done"
        disabled={busy}
        align="right"
        items={DONE_REASONS.map((r) => ({
          key: r,
          label: DONE_REASON_LABELS[r],
          onSelect: () => void patch(followupId, { action: 'done', doneReason: r }),
        }))}
      />
      <Menu
        label="Snooze"
        disabled={busy}
        align="right"
        items={SNOOZE_PRESETS.map((p) => ({
          key: p,
          label: SNOOZE_LABELS[p],
          onSelect: () => void patch(followupId, { action: 'snooze', preset: p }),
        }))}
      />
      {error ? <span className="text-xs text-[#A12B2B]">{error}</span> : null}
    </div>
  )
}
