'use client'

import { useState } from 'react'
import {
  DONE_REASONS,
  DONE_REASON_LABELS,
  FOLLOWUP_REASONS,
  REASON_LABELS,
  SNOOZE_LABELS,
  SNOOZE_PRESETS,
  type VoixFollowup,
  type VoixFollowupEvent,
} from '@/lib/voix/types'
import { BTN_DARK, BTN_LIGHT, Menu, useFollowupAction } from './followupClient'

type MemberOption = { id: string; label: string }

const EVENT_VERB: Record<VoixFollowupEvent['type'], string> = {
  created: 'opened this follow-up',
  note: 'added a note',
  called: 'called back',
  assigned: 'changed the owner',
  snoozed: 'snoozed it',
  reopened: 'reopened it',
  done: 'marked it done',
}

export default function FollowupPanel({
  accountId,
  callId,
  callerPhone,
  timezone,
  followup,
  events,
  members,
  myMemberId,
}: {
  accountId: string
  callId: string
  callerPhone: string | null
  timezone: string
  followup: VoixFollowup | null
  events: VoixFollowupEvent[]
  members: MemberOption[]
  myMemberId: string | null
}) {
  const { busy, error, patch, create } = useFollowupAction()
  const [note, setNote] = useState('')
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
      new Date(iso),
    )

  if (!followup) {
    return (
      <div className="rounded-2xl border border-[#ECEDF1] bg-white p-5">
        <h2 className="text-[15px] font-semibold">Follow-up</h2>
        <p className="mt-1 text-sm text-[#5B6070]">Voix didn&apos;t flag this call. Need someone to follow up anyway?</p>
        <div className="mt-4">
          <Menu
            label={busy ? 'Saving…' : 'Create follow-up'}
            tone="dark"
            disabled={busy}
            items={FOLLOWUP_REASONS.filter((r) => r !== 'urgent').map((r) => ({
              key: r,
              label: REASON_LABELS[r],
              onSelect: () => void create({ accountId, callId, reason: r }),
            }))}
          />
        </div>
        {error ? <p className="mt-3 text-sm text-[#A12B2B]">{error}</p> : null}
      </div>
    )
  }

  const snoozedActive = followup.status === 'snoozed' && followup.snoozed_until && new Date(followup.snoozed_until) > new Date()
  const state = followup.status === 'done' ? 'Done' : snoozedActive ? `Snoozed until ${fmt(followup.snoozed_until!)}` : 'Open'
  const tel = callerPhone ? `tel:${callerPhone.replace(/[^\d+]/g, '')}` : null

  return (
    <div className="rounded-2xl border border-[#ECEDF1] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Follow-up</h2>
          <p className="mt-0.5 text-sm text-[#4A5061]">{REASON_LABELS[followup.reason]}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            followup.status === 'done'
              ? 'bg-[#E7F6EE] text-[#17663F]'
              : followup.priority === 'urgent'
                ? 'bg-[#FDECEC] text-[#A12B2B]'
                : 'bg-[#FFF4E0] text-[#8A5A00]'
          }`}
        >
          {followup.status !== 'done' && followup.priority === 'urgent' ? 'Urgent · ' : ''}
          {state}
        </span>
      </div>

      {followup.status !== 'done' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tel ? (
            <a
              href={tel}
              onClick={() => void patch(followup.id, { action: 'called' })}
              className={BTN_DARK}
            >
              Call back
            </a>
          ) : null}
          <Menu
            label="Mark done"
            disabled={busy}
            items={DONE_REASONS.map((r) => ({
              key: r,
              label: DONE_REASON_LABELS[r],
              onSelect: () => void patch(followup.id, { action: 'done', doneReason: r }),
            }))}
          />
          <Menu
            label="Snooze"
            disabled={busy}
            items={SNOOZE_PRESETS.map((p) => ({
              key: p,
              label: SNOOZE_LABELS[p],
              onSelect: () => void patch(followup.id, { action: 'snooze', preset: p }),
            }))}
          />
          <button
            type="button"
            disabled
            title="Texting turns on once SMS registration (10DLC) is approved"
            className={`${BTN_LIGHT} cursor-not-allowed`}
          >
            Text back · soon
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <button type="button" disabled={busy} onClick={() => void patch(followup.id, { action: 'reopen' })} className={BTN_LIGHT}>
            Reopen
          </button>
        </div>
      )}

      <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#5B6070]">Owner</label>
      <div className="mt-1.5 flex items-center gap-2">
        <select
          value={followup.assigned_member_id ?? ''}
          disabled={busy}
          onChange={(e) => void patch(followup.id, { action: 'assign', memberId: e.target.value || null })}
          className="w-full rounded-lg border border-[#ECEDF1] bg-white px-2.5 py-2 text-sm"
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        {myMemberId && followup.assigned_member_id !== myMemberId ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void patch(followup.id, { action: 'assign', memberId: myMemberId })}
            className="whitespace-nowrap text-sm font-medium text-[#3355D6]"
          >
            Take it
          </button>
        ) : null}
      </div>

      <form
        className="mt-5"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!note.trim()) return
          if (await patch(followup.id, { action: 'note', note })) setNote('')
        }}
      >
        <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#5B6070]" htmlFor="voix-note">
          Add a note
        </label>
        <textarea
          id="voix-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Left a voicemail, will try again at 2pm"
          className="mt-1.5 w-full resize-y rounded-lg border border-[#ECEDF1] px-3 py-2 text-sm outline-none focus:border-[#3355D6]"
        />
        <div className="mt-2 flex justify-end">
          <button type="submit" disabled={busy || !note.trim()} className={BTN_LIGHT}>
            Save note
          </button>
        </div>
      </form>

      {error ? <p className="mt-2 text-sm text-[#A12B2B]">{error}</p> : null}

      {events.length ? (
        <ol className="mt-5 space-y-3 border-t border-[#ECEDF1] pt-4">
          {events.map((ev) => (
            <li key={ev.id} className="text-sm">
              <div className="text-[#1B2236]">
                <span className="font-medium">{ev.actor_label ?? 'Someone'}</span>{' '}
                <span className="text-[#4A5061]">{EVENT_VERB[ev.type]}</span>
                <span className="text-xs text-[#5B6070]"> · {fmt(ev.created_at)}</span>
              </div>
              {ev.body ? <p className="mt-0.5 whitespace-pre-wrap text-[#4A5061]">{ev.body}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
