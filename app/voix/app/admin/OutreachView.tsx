'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  PROSPECT_CHANNELS,
  PROSPECT_CHANNEL_LABEL,
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABEL,
  type ProspectRun,
  type ProspectStatus,
  type VoixProspect,
} from '@/lib/voix/prospects'

const STATUS_TONE: Record<ProspectStatus, string> = {
  to_contact: 'bg-[#F1F2F5] text-[#4A5061]',
  contacted: 'bg-[#EAF0FF] text-[#3355D6]',
  replied: 'bg-[#FFF4E0] text-[#8A5A00]',
  demo: 'bg-[#F3EAFF] text-[#6B3FC4]',
  pilot: 'bg-[#E6F6EC] text-[#17663F]',
  not_interested: 'bg-[#F7EDED] text-[#A12B2B]',
}

const input = 'w-full rounded-lg border border-[#ECEDF1] bg-white px-3 py-2 text-sm outline-none focus:border-[#3355D6]'

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shortDate(value: string | null): string {
  if (!value) return ''
  const d = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function useProspects() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function call(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/voix/admin/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return false
      }
      router.refresh()
      return true
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, call }
}

function DetailsFields({ p }: { p?: VoixProspect }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <input name="spa_name" required defaultValue={p?.spa_name ?? ''} placeholder="Spa name *" className={input} />
      <input name="website" defaultValue={p?.website ?? ''} placeholder="Website" className={input} />
      <input name="instagram" defaultValue={p?.instagram ?? ''} placeholder="Instagram handle or link" className={input} />
      <input name="city" defaultValue={p?.city ?? ''} placeholder="City" className={input} />
      <input name="contact_name" defaultValue={p?.contact_name ?? ''} placeholder="Contact (owner, manager)" className={input} />
      <input name="email" type="email" defaultValue={p?.email ?? ''} placeholder="Email" className={input} />
      <input name="phone" defaultValue={p?.phone ?? ''} placeholder="Phone" className={input} />
      <select name="channel" defaultValue={p?.channel ?? 'ig_dm'} className={input}>
        {PROSPECT_CHANNELS.map((c) => (
          <option key={c} value={c}>
            {PROSPECT_CHANNEL_LABEL[c]}
          </option>
        ))}
      </select>
    </div>
  )
}

function formFields(e: FormEvent<HTMLFormElement>) {
  const f = new FormData(e.currentTarget)
  return Object.fromEntries(['spa_name', 'website', 'instagram', 'city', 'contact_name', 'email', 'phone', 'channel'].map((k) => [k, String(f.get(k) ?? '')]))
}

function AddProspect() {
  const { busy, error, call } = useProspects()
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-[#1B2236] px-4 py-2 text-sm font-medium text-white">
        + Add spa
      </button>
    )
  }
  return (
    <form
      className="w-full space-y-3 rounded-xl border border-[#ECEDF1] bg-[#FAFAFB] p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const form = e.currentTarget
        if (await call({ action: 'create', ...formFields(e) })) {
          form.reset()
          setOpen(false)
        }
      }}
    >
      <DetailsFields />
      {error ? <p className="text-sm text-[#A12B2B]">{error}</p> : null}
      <div className="flex gap-2">
        <button disabled={busy} className="rounded-full bg-[#1B2236] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? 'Saving…' : 'Add'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-[#ECEDF1] bg-white px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}

function emailText(p: VoixProspect, footer: string): string {
  return `${p.email_body ?? ''}\n\n${footer}`
}

/** Gmail compose in a new tab: works without a desktop mail app. */
function gmailHref(p: VoixProspect, footer: string): string {
  const q = new URLSearchParams({ view: 'cm', fs: '1', to: p.email ?? '', su: p.email_subject ?? '', body: emailText(p, footer) })
  return `https://mail.google.com/mail/?${q.toString()}`
}

function mailtoHref(p: VoixProspect, footer: string): string {
  return `mailto:${p.email ?? ''}?subject=${encodeURIComponent(p.email_subject ?? '')}&body=${encodeURIComponent(emailText(p, footer))}`
}

function EmailButtons({ p, footer }: { p: VoixProspect; footer: string }) {
  const [copied, setCopied] = useState(false)
  if (!p.email_body) return null
  return (
    <>
      <a
        href={gmailHref(p, footer)}
        target="_blank"
        rel="noreferrer"
        title={p.email ? `Opens a Gmail draft to ${p.email}` : 'Opens a Gmail draft. No email on file: add the address in Gmail'}
        className="rounded-full bg-[#1B2236] px-3 py-1.5 text-sm font-medium text-white"
      >
        Open in Gmail
      </a>
      <button
        type="button"
        onClick={async () => {
          const text = `${p.email ? `To: ${p.email}\n` : ''}Subject: ${p.email_subject ?? ''}\n\n${emailText(p, footer)}`
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            window.location.href = mailtoHref(p, footer)
          }
        }}
        title="Copy the address, subject and email"
        className="rounded-full border border-[#ECEDF1] bg-white px-3 py-1.5 text-sm font-medium"
      >
        {copied ? 'Copied' : 'Copy email'}
      </button>
    </>
  )
}

function ProspectRow({ p, footer }: { p: VoixProspect; footer: string }) {
  const { busy, error, call } = useProspects()
  const [editing, setEditing] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState(p.notes ?? '')
  const due = p.next_follow_up && p.next_follow_up <= today() && !['pilot', 'not_interested'].includes(p.status)
  const ig = p.instagram?.startsWith('@') ? `https://instagram.com/${p.instagram.slice(1)}` : null

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (await call({ action: 'update', id: p.id, ...formFields(e) })) setEditing(false)
          }}
        >
          <DetailsFields p={p} />
          {error ? <p className="text-sm text-[#A12B2B]">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} className="rounded-full bg-[#1B2236] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-[#ECEDF1] bg-white px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Remove ${p.spa_name} from outreach?`)) void call({ action: 'delete', id: p.id })
              }}
              className="ml-auto text-sm text-[#A12B2B]"
            >
              Remove
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{p.spa_name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[p.status]}`}>{PROSPECT_STATUS_LABEL[p.status]}</span>
            {due ? <span className="rounded-full bg-[#FDECEC] px-2 py-0.5 text-xs font-medium text-[#A12B2B]">Follow up</span> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[#5B6070]">
            {p.city ? <span>{p.city}</span> : null}
            {p.contact_name ? <span>{p.contact_name}</span> : null}
            <span>{PROSPECT_CHANNEL_LABEL[p.channel]}</span>
            {p.phone ? (
              <a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`} className="text-[#3355D6]">
                {p.phone}
              </a>
            ) : null}
            {p.email ? (
              <a href={`mailto:${p.email}`} className="text-[#3355D6]">
                {p.email}
              </a>
            ) : null}
            {p.website ? (
              <a href={p.website} target="_blank" rel="noreferrer" className="text-[#3355D6]">
                {p.website.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            ) : null}
            {ig ? (
              <a href={ig} target="_blank" rel="noreferrer" className="text-[#3355D6]">
                {p.instagram}
              </a>
            ) : p.instagram ? (
              <span>{p.instagram}</span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-[#8A8F9C]">
            {p.last_contacted_at ? `Last contacted ${shortDate(p.last_contacted_at)}` : 'Not contacted yet'}
            {p.next_follow_up ? ` · Follow up ${shortDate(p.next_follow_up)}` : ''}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={p.status}
            disabled={busy}
            onChange={(e) => void call({ action: 'update', id: p.id, status: e.target.value })}
            className="rounded-lg border border-[#ECEDF1] bg-white px-2 py-1.5 text-sm"
          >
            {PROSPECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROSPECT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={p.next_follow_up ?? ''}
            disabled={busy}
            title="Next follow-up"
            onChange={(e) => void call({ action: 'update', id: p.id, next_follow_up: e.target.value || null })}
            className="rounded-lg border border-[#ECEDF1] bg-white px-2 py-1.5 text-sm"
          />
          <EmailButtons p={p} footer={footer} />
          <button
            type="button"
            disabled={busy}
            onClick={() => void call({ action: 'contacted_today', id: p.id })}
            className="rounded-full border border-[#ECEDF1] bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            Contacted today
          </button>
        </div>
      </div>
      <div className="mt-2 flex gap-4 text-sm">
        <button type="button" onClick={() => setShowNotes((v) => !v)} className="font-medium text-[#3355D6]">
          {showNotes ? 'Hide notes' : p.notes ? 'Notes' : 'Add notes'}
        </button>
        <button type="button" onClick={() => setEditing(true)} className="text-[#5B6070]">
          Edit details
        </button>
      </div>
      {showNotes ? (
        <div className="mt-2 space-y-2">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="What you sent, what they said…" className={input} />
          <button
            type="button"
            disabled={busy || notes === (p.notes ?? '')}
            onClick={() => void call({ action: 'update', id: p.id, notes })}
            className="rounded-full bg-[#1B2236] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Save notes
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-[#A12B2B]">{error}</p> : null}
    </li>
  )
}

type Filter = 'active' | 'due' | 'all'

function runLabel(run: ProspectRun | null): string {
  if (!run) return 'When every spa here has been contacted, Voix finds 5 new independent med spas and drafts the call note, email and DM.'
  const when = new Date(run.finished_at ?? run.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  if (run.status === 'running') return 'Finding 5 new spas… refresh in a minute.'
  if (run.status === 'failed') return `Last search failed (${when}): ${run.error ?? 'unknown error'}`
  return `Last search ${when}: added ${run.added} spa${run.added === 1 ? '' : 's'}. Runs again when "To contact" is empty.`
}

function FindMore({ run }: { run: ProspectRun | null }) {
  const { busy, error, call } = useProspects()
  const running = run?.status === 'running'
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-[#FAFAFB] px-4 py-3 text-sm text-[#5B6070]">
      <span className="min-w-0 flex-1">{runLabel(run)}</span>
      <button
        type="button"
        disabled={busy || running}
        onClick={() => void call({ action: 'find_more' })}
        className="rounded-full border border-[#ECEDF1] bg-white px-3 py-1.5 font-medium text-[#1B2236] disabled:opacity-50"
      >
        {busy ? 'Starting…' : 'Find 5 more now'}
      </button>
      {error ? <span className="w-full text-[#A12B2B]">{error}</span> : null}
    </div>
  )
}

export default function OutreachView({
  prospects,
  lastRun,
  footer,
}: {
  prospects: VoixProspect[]
  lastRun: ProspectRun | null
  footer: string
}) {
  const [filter, setFilter] = useState<Filter>('active')
  const t = today()
  const isActive = (p: VoixProspect) => !['pilot', 'not_interested'].includes(p.status)
  const isDue = (p: VoixProspect) => isActive(p) && !!p.next_follow_up && p.next_follow_up <= t
  const counts = Object.fromEntries(PROSPECT_STATUSES.map((s) => [s, prospects.filter((p) => p.status === s).length])) as Record<
    ProspectStatus,
    number
  >
  const list = prospects.filter((p) => (filter === 'all' ? true : filter === 'due' ? isDue(p) : isActive(p)))
  const chip = (key: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(key)}
      className={`rounded-full px-3 py-1.5 text-sm ${filter === key ? 'bg-[#1B2236] text-white' : 'border border-[#ECEDF1] bg-white text-[#4A5061]'}`}
    >
      {label}
    </button>
  )

  return (
    <section className="rounded-2xl border border-[#ECEDF1] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Outreach</h2>
          <p className="text-sm text-[#5B6070]">
            Spas we&apos;re pitching. {counts.to_contact} to contact · {counts.contacted} waiting · {counts.replied + counts.demo} in conversation
            · {counts.pilot} in pilot.
          </p>
        </div>
        <AddProspect />
      </div>
      <FindMore run={lastRun} />
      <div className="mt-4 flex flex-wrap gap-2">
        {chip('active', `Active (${prospects.filter(isActive).length})`)}
        {chip('due', `Follow-ups due (${prospects.filter(isDue).length})`)}
        {chip('all', `All (${prospects.length})`)}
      </div>
      {list.length ? (
        <ul className="mt-4 divide-y divide-[#ECEDF1] rounded-xl border border-[#ECEDF1]">
          {list.map((p) => (
            <ProspectRow key={`${p.id}-${p.updated_at}`} p={p} footer={footer} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-[#ECEDF1] px-4 py-6 text-center text-sm text-[#5B6070]">
          {filter === 'due' ? 'No follow-ups due. Nice.' : 'No spas here yet.'}
        </p>
      )}
    </section>
  )
}
