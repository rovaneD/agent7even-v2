import Link from 'next/link'
import type { MonitorData, SpaHealth } from '@/lib/voix/monitor'
import { formatDateTime, formatPhone, timeAgo } from '@/lib/voix/format'
import OutcomeBadge from '../_components/OutcomeBadge'

function ago(iso: string | null) {
  return iso ? timeAgo(iso) : 'never'
}

function Cell({ value, label, tone }: { value: string | number; label: string; tone?: 'bad' | 'warn' | 'good' }) {
  const color = tone === 'bad' ? 'text-[#A12B2B]' : tone === 'warn' ? 'text-[#8A5A00]' : tone === 'good' ? 'text-[#17663F]' : 'text-[#1B2236]'
  return (
    <div className="rounded-xl bg-[#F6F7F9] px-3 py-2.5">
      <div className={`text-lg font-semibold leading-none tracking-tight ${color}`}>{value}</div>
      <div className="mt-1 text-[11px] text-[#5B6070]">{label}</div>
    </div>
  )
}

function SpaCard({ s }: { s: SpaHealth }) {
  const critical = s.problems.some((p) => p.severity === 'critical')
  const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`)
  return (
    <section
      className={`rounded-2xl border bg-white p-5 ${critical ? 'border-[#F2B8B8]' : s.problems.length ? 'border-[#F0D9A8]' : 'border-[#ECEDF1]'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${critical ? 'bg-[#D64545]' : s.problems.length ? 'bg-[#E0A21B]' : 'bg-[#2FA36B]'}`}
            />
            <h2 className="text-lg font-semibold tracking-tight">{s.account.name}</h2>
            <span className="rounded-full bg-[#F2F3F6] px-2 py-0.5 text-[11px] font-medium capitalize text-[#5B6070]">
              {s.account.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#5B6070]">
            Last call {ago(s.lastCallAt)} · Last webhook {ago(s.lastWebhookAt)} · Staff last seen {ago(s.staffLastSeenAt)} · Digest{' '}
            {s.account.digest_enabled ? (s.lastDigestAt ? `sent ${ago(s.lastDigestAt)}` : 'not sent yet') : 'off'}
          </p>
        </div>
        <Link
          href={`/voix/app/${s.account.id}/calls`}
          className="rounded-full border border-[#D5D8E0] bg-white px-3.5 py-1.5 text-sm font-medium"
        >
          View as spa →
        </Link>
      </div>

      {s.problems.length ? (
        <ul className="mt-3 space-y-1">
          {s.problems.map((p) => (
            <li key={p.text} className={`text-sm ${p.severity === 'critical' ? 'text-[#A12B2B]' : 'text-[#8A5A00]'}`}>
              {p.severity === 'critical' ? '●' : '○'} {p.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[#17663F]">✓ Nothing needs attention</p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Cell value={s.callsToday} label="Calls today" />
        <Cell value={s.calls7d} label="Calls, 7 days" />
        <Cell value={s.booked7d} label="Booked, 7 days" tone={s.booked7d ? 'good' : undefined} />
        <Cell
          value={pct(s.hangupRate7d)}
          label="Hang up < 15s"
          tone={s.hangupRate7d != null && s.hangupRate7d > 0.2 ? 'warn' : undefined}
        />
        <Cell
          value={s.openFollowups}
          label={s.urgentOpen ? `Open · ${s.urgentOpen} urgent` : 'Open follow-ups'}
          tone={s.urgentOpen ? 'bad' : s.overdueFollowups ? 'warn' : undefined}
        />
        <Cell
          value={s.avgHoursToDone7d == null ? '—' : s.avgHoursToDone7d < 1 ? `${Math.round(s.avgHoursToDone7d * 60)}m` : `${s.avgHoursToDone7d.toFixed(1)}h`}
          label="Avg time to done"
          tone={s.avgHoursToDone7d != null && s.avgHoursToDone7d > 24 ? 'warn' : undefined}
        />
      </div>
      <p className="mt-3 text-xs text-[#5B6070]">
        {s.person7d} calls needed a person this week · {s.staffJoined}/{s.staffInvited} staff signed in
        {s.oldestOpenAt ? ` · oldest open follow-up ${ago(s.oldestOpenAt)}` : ''}
      </p>
    </section>
  )
}

export default function MonitorView({ data, accountNames }: { data: MonitorData; accountNames: Record<string, string> }) {
  const webhookTone = data.webhookErrors24h || data.badSignatures24h ? 'bad' : data.lastWebhookAt ? 'good' : 'warn'
  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#ECEDF1] bg-white px-4 py-3.5 sm:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5B6070]">Retell webhook</div>
          <div
            className={`mt-1.5 text-[15px] font-medium ${webhookTone === 'bad' ? 'text-[#A12B2B]' : webhookTone === 'good' ? 'text-[#17663F]' : 'text-[#8A5A00]'}`}
          >
            {data.lastWebhookAt ? `Last delivery ${timeAgo(data.lastWebhookAt)}` : 'No deliveries received yet'}
          </div>
          <div className="mt-0.5 text-xs text-[#5B6070]">
            {data.webhookErrors24h} errors · {data.badSignatures24h} bad signatures in the last 24h
          </div>
        </div>
        <div className="rounded-2xl border border-[#ECEDF1] bg-white px-4 py-3.5">
          <div className="text-[26px] font-semibold leading-none">{data.spas.reduce((n, s) => n + s.callsToday, 0)}</div>
          <div className="mt-1.5 text-xs text-[#5B6070]">Calls today, all spas</div>
        </div>
        <div className="rounded-2xl border border-[#ECEDF1] bg-white px-4 py-3.5">
          <div className="text-[26px] font-semibold leading-none">
            {data.spas.reduce((n, s) => n + s.openFollowups, 0)}
            <span className="ml-1 text-sm font-medium text-[#A12B2B]">
              {data.spas.reduce((n, s) => n + s.urgentOpen, 0) ? `${data.spas.reduce((n, s) => n + s.urgentOpen, 0)} urgent` : ''}
            </span>
          </div>
          <div className="mt-1.5 text-xs text-[#5B6070]">Open follow-ups, all spas</div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5B6070]">Spas · needs attention first</h2>
        {data.spas.length ? data.spas.map((s) => <SpaCard key={s.account.id} s={s} />) : <p className="text-sm text-[#5B6070]">No spas yet.</p>}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#5B6070]">Flagged calls · last 7 days</h2>
        {data.flagged.length ? (
          <ul className="divide-y divide-[#ECEDF1] overflow-hidden rounded-2xl border border-[#ECEDF1] bg-white">
            {data.flagged.map((c) => (
              <li key={c.id}>
                <Link href={`/voix/app/${c.account_id}/calls/${c.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-[#F9FAFB]">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{c.caller_name || formatPhone(c.from_number)}</span>
                      <span className="text-[#5B6070]">· {accountNames[c.account_id] ?? 'Unknown spa'}</span>
                      <span className="text-xs text-[#5B6070]">· {formatDateTime(c.started_at, 'America/Los_Angeles')} PT</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-sm text-[#4A5061]">{c.summary}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <OutcomeBadge outcome={c.outcome} />
                    <span
                      className={`text-xs ${c.followup_status === 'done' ? 'text-[#17663F]' : c.followup_status ? 'text-[#A12B2B]' : 'text-[#5B6070]'}`}
                    >
                      {c.followup_status === 'done' ? 'Handled' : c.followup_status ? 'Not handled yet' : 'No follow-up'}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#5B6070]">No urgent, clinical or complaint calls this week.</p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#5B6070]">Webhook issues · last 7 days</h2>
        {data.webhookProblems.length ? (
          <div className="overflow-x-auto rounded-2xl border border-[#ECEDF1] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-[#5B6070]">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Result</th>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Spa / agent</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEDF1]">
                {data.webhookProblems.map((w) => (
                  <tr key={w.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-[#5B6070]">{timeAgo(w.received_at)}</td>
                    <td className={`px-4 py-2 font-medium ${w.result === 'ignored' ? 'text-[#5B6070]' : 'text-[#A12B2B]'}`}>{w.result.replace('_', ' ')}</td>
                    <td className="px-4 py-2">{w.event ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{w.account_id ? accountNames[w.account_id] : w.agent_id ?? '—'}</td>
                    <td className="px-4 py-2 text-[#4A5061]">{w.detail ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#5B6070]">No failed or ignored deliveries.</p>
        )}
      </section>
    </div>
  )
}
