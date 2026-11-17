'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { VoixAccount, VoixMember } from '@/lib/voix/types'

type AccountRow = VoixAccount & { members: VoixMember[]; calls: { real: number; sample: number } }

const INPUT = 'w-full rounded-lg border border-[#ECEDF1] bg-white px-3 py-2 text-sm outline-none focus:border-[#3355D6]'
const LABEL = 'mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#5B6070]'
const BTN = 'rounded-full bg-[#1B2236] px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
const BTN_LIGHT = 'rounded-full border border-[#D5D8E0] bg-white px-4 py-2 text-sm font-medium disabled:opacity-50'

function useAdmin() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  async function call(body: Record<string, unknown>, okText: string) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/voix/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; invited?: boolean }
      if (!res.ok) {
        setMessage({ tone: 'error', text: data.error ?? 'Something went wrong' })
        return null
      }
      setMessage({ tone: 'ok', text: okText + (body.sendInvite ? (data.invited ? ' Invite sent.' : ' Invite email failed — send the link yourself.') : '') })
      router.refresh()
      return data
    } finally {
      setBusy(false)
    }
  }
  return { busy, message, call }
}

function Message({ message }: { message: { tone: 'ok' | 'error'; text: string } | null }) {
  if (!message) return null
  return <p className={`text-sm ${message.tone === 'ok' ? 'text-[#17663F]' : 'text-[#A12B2B]'}`}>{message.text}</p>
}

function AccountForm({ account, onDone }: { account?: AccountRow; onDone?: () => void }) {
  const { busy, message, call } = useAdmin()
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const body = {
      action: account ? 'update_account' : 'create_account',
      accountId: account?.id,
      name: f.get('name'),
      timezone: f.get('timezone'),
      agentIds: f.get('agentIds'),
      phoneNumber: f.get('phoneNumber'),
      transferNumber: f.get('transferNumber'),
      alertEmails: f.get('alertEmails'),
      status: f.get('status'),
    }
    const ok = await call(body, account ? 'Saved.' : 'Spa created.')
    if (ok && !account) form.reset()
    if (ok) onDone?.()
  }
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className={LABEL}>Spa name</label>
        <input name="name" required defaultValue={account?.name} placeholder="Urban Medical Spa" className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Timezone</label>
        <input name="timezone" defaultValue={account?.timezone ?? 'America/Los_Angeles'} className={INPUT} />
      </div>
      <div className="sm:col-span-2">
        <label className={LABEL}>Retell agent ID(s)</label>
        <input
          name="agentIds"
          defaultValue={account?.retell_agent_ids.join(', ')}
          placeholder="agent_ed19e374c1a3aa2a76a8cb46c6"
          className={`${INPUT} font-mono`}
        />
        <p className="mt-1 text-xs text-[#5B6070]">Calls from these agents land in this spa&apos;s dashboard. One per location is fine.</p>
      </div>
      <div>
        <label className={LABEL}>Voix phone number</label>
        <input name="phoneNumber" defaultValue={account?.phone_number ?? ''} placeholder="+1 310 555 0100" className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Staff transfer number</label>
        <input name="transferNumber" defaultValue={account?.transfer_number ?? ''} placeholder="Front desk line" className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Alert emails</label>
        <input
          name="alertEmails"
          defaultValue={account?.alert_emails.join(', ')}
          placeholder="owner@spa.com, frontdesk@spa.com"
          className={INPUT}
        />
        <p className="mt-1 text-xs text-[#5B6070]">Empty = email the spa&apos;s owners.</p>
      </div>
      <div>
        <label className={LABEL}>Status</label>
        <select name="status" defaultValue={account?.status ?? 'pilot'} className={INPUT}>
          <option value="pilot">Pilot</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={busy} className={BTN}>
          {busy ? 'Saving…' : account ? 'Save changes' : 'Create spa'}
        </button>
        <Message message={message} />
      </div>
    </form>
  )
}

function Members({ account }: { account: AccountRow }) {
  const { busy, message, call } = useAdmin()
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const ok = await call(
      {
        action: 'add_member',
        accountId: account.id,
        email: f.get('email'),
        fullName: f.get('fullName'),
        role: f.get('role'),
        sendInvite: f.get('sendInvite') === 'on',
      },
      'Added.',
    )
    if (ok) form.reset()
  }
  return (
    <div>
      <h3 className="text-sm font-semibold">Staff with access</h3>
      {account.members.length ? (
        <ul className="mt-2 divide-y divide-[#ECEDF1] rounded-xl border border-[#ECEDF1]">
          {account.members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{m.full_name || m.email}</span>
                {m.full_name ? <span className="text-[#5B6070]"> · {m.email}</span> : null}
                <span className="text-[#5B6070]"> · {m.role === 'owner' ? 'Owner' : 'Staff'}</span>
                <span className={m.joined_at ? 'text-[#17663F]' : 'text-[#8A5A00]'}> · {m.joined_at ? 'Signed in' : 'Invited'}</span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Remove ${m.email} from ${account.name}?`)) {
                    void call({ action: 'remove_member', accountId: account.id, memberId: m.id }, 'Removed.')
                  }
                }}
                className="text-xs font-medium text-[#A12B2B]"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-[#5B6070]">No one yet.</p>
      )}
      <form onSubmit={add} className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_1fr_auto_auto]">
        <input name="email" type="email" required placeholder="name@spa.com" className={INPUT} />
        <input name="fullName" placeholder="Name (optional)" className={INPUT} />
        <select name="role" defaultValue="staff" className={INPUT}>
          <option value="staff">Staff</option>
          <option value="owner">Owner</option>
        </select>
        <button type="submit" disabled={busy} className={BTN}>
          Add
        </button>
        <label className="flex items-center gap-2 text-sm text-[#4A5061] sm:col-span-4">
          <input type="checkbox" name="sendInvite" defaultChecked /> Email them an invite with the sign-up link
        </label>
      </form>
      <div className="mt-2">
        <Message message={message} />
      </div>
    </div>
  )
}

function AccountCard({ account }: { account: AccountRow }) {
  const [editing, setEditing] = useState(false)
  const { busy, message, call } = useAdmin()
  const checks = [
    { ok: account.retell_agent_ids.length > 0, label: 'Retell agent linked' },
    { ok: account.members.some((m) => m.role === 'owner') || account.alert_emails.length > 0, label: 'Someone gets alerts' },
    { ok: account.members.some((m) => m.joined_at), label: 'Staff signed in' },
    { ok: account.calls.real > 0, label: 'First real call received' },
  ]
  return (
    <section className="rounded-2xl border border-[#ECEDF1] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{account.name}</h2>
          <p className="mt-0.5 text-sm text-[#5B6070]">
            {account.status[0].toUpperCase() + account.status.slice(1)} · {account.calls.real} calls
            {account.calls.sample ? ` · ${account.calls.sample} sample` : ''} · {account.timezone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/voix/app/${account.id}/calls`} className={BTN}>
            Open dashboard
          </Link>
          <button type="button" onClick={() => setEditing((v) => !v)} className={BTN_LIGHT}>
            {editing ? 'Close' : 'Edit'}
          </button>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {checks.map((c) => (
          <li
            key={c.label}
            className={`rounded-full px-3 py-1 text-xs font-medium ${c.ok ? 'bg-[#E7F6EE] text-[#17663F]' : 'bg-[#F2F3F6] text-[#5B6070]'}`}
          >
            {c.ok ? '✓' : '○'} {c.label}
          </li>
        ))}
      </ul>

      {editing ? (
        <div className="mt-5 border-t border-[#ECEDF1] pt-5">
          <AccountForm account={account} onDone={() => setEditing(false)} />
        </div>
      ) : null}

      <div className="mt-5 border-t border-[#ECEDF1] pt-5">
        <Members account={account} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#ECEDF1] pt-5">
        <span className="mr-2 text-sm font-semibold">Sample calls</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void call({ action: 'add_samples', accountId: account.id }, 'Added 8 sample calls.')}
          className={BTN_LIGHT}
        >
          Add samples
        </button>
        {account.calls.sample ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void call({ action: 'remove_samples', accountId: account.id }, 'Sample calls removed.')}
            className={BTN_LIGHT}
          >
            Remove samples
          </button>
        ) : null}
        <Message message={message} />
      </div>
    </section>
  )
}

export default function AdminConsole({ accounts }: { accounts: AccountRow[] }) {
  const [creating, setCreating] = useState(accounts.length === 0)
  return (
    <div className="space-y-6">
      {accounts.map((a) => (
        <AccountCard key={a.id} account={a} />
      ))}
      <section className="rounded-2xl border border-dashed border-[#D5D8E0] bg-white p-5 sm:p-6">
        {creating ? (
          <>
            <h2 className="mb-4 text-lg font-semibold">New spa</h2>
            <AccountForm onDone={() => setCreating(false)} />
          </>
        ) : (
          <button type="button" onClick={() => setCreating(true)} className={BTN}>
            + New spa
          </button>
        )}
      </section>
    </div>
  )
}
