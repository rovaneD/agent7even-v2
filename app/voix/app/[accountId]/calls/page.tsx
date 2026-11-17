import Link from 'next/link'
import { requireVoixAccount } from '@/lib/voix/access'
import { dayLabel, formatDuration, formatPhone, formatTime, startOfZonedDay } from '@/lib/voix/format'
import { CALL_LIST_SELECT, type VoixCall, type VoixOutcome } from '@/lib/voix/types'
import OutcomeBadge from '../../_components/OutcomeBadge'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

const TABS: { key: string; label: string; outcomes: VoixOutcome[] | null }[] = [
  { key: 'all', label: 'All calls', outcomes: null },
  { key: 'person', label: 'Needs a person', outcomes: ['callback_needed', 'clinical', 'complaint'] },
  { key: 'booked', label: 'Booked', outcomes: ['booked', 'rescheduled'] },
  { key: 'questions', label: 'Questions', outcomes: ['question_answered'] },
  { key: 'other', label: 'Other', outcomes: ['cancelled', 'spam', 'hang_up', 'other'] },
]

type ListCall = Pick<
  VoixCall,
  | 'id'
  | 'status'
  | 'from_number'
  | 'caller_name'
  | 'started_at'
  | 'duration_sec'
  | 'summary'
  | 'outcome'
  | 'urgent'
  | 'treatment_interest'
  | 'is_sample'
>

export default async function CallsPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>
  searchParams: Promise<{ tab?: string; q?: string; before?: string }>
}) {
  const { accountId } = await params
  const sp = await searchParams
  const { account, supabase } = await requireVoixAccount(accountId)
  const tz = account.timezone

  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0]
  const q = (sp.q ?? '').replace(/[^\p{L}\p{N} +\-'.@]/gu, '').trim().slice(0, 60)
  const before = sp.before && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before).toISOString() : null

  let query = supabase
    .from('voix_calls')
    .select(CALL_LIST_SELECT)
    .eq('account_id', account.id)
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(PAGE_SIZE + 1)
  if (tab.outcomes) query = query.in('outcome', tab.outcomes)
  if (before) query = query.lt('started_at', before)
  if (q) {
    const digits = q.replace(/\D/g, '')
    const ors = [`caller_name.ilike.%${q.replace(/[%_]/g, '')}%`]
    if (digits.length >= 3) ors.push(`from_number.ilike.%${digits}%`)
    query = query.or(ors.join(','))
  }

  const todayStart = startOfZonedDay(tz).toISOString()
  const weekStart = startOfZonedDay(tz, new Date(), -6).toISOString()

  const [{ data: rows }, { count: todayCount }, { count: weekCount }, { count: weekBooked }, { count: weekPerson }] =
    await Promise.all([
      query,
      supabase.from('voix_calls').select('id', { count: 'exact', head: true }).eq('account_id', account.id).gte('started_at', todayStart),
      supabase.from('voix_calls').select('id', { count: 'exact', head: true }).eq('account_id', account.id).gte('started_at', weekStart),
      supabase
        .from('voix_calls')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', account.id)
        .gte('started_at', weekStart)
        .in('outcome', ['booked', 'rescheduled']),
      supabase
        .from('voix_calls')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', account.id)
        .gte('started_at', weekStart)
        .in('outcome', ['callback_needed', 'clinical', 'complaint']),
    ])

  const all = (rows ?? []) as ListCall[]
  const calls = all.slice(0, PAGE_SIZE)
  const nextBefore = all.length > PAGE_SIZE ? calls[calls.length - 1]?.started_at : null

  const callIds = calls.map((c) => c.id)
  const { data: fups } = callIds.length
    ? await supabase.from('voix_followups').select('call_id, status').in('call_id', callIds)
    : { data: [] as { call_id: string; status: string }[] }
  const fupByCall = new Map((fups ?? []).map((f) => [f.call_id as string, f.status as string]))

  const groups: { label: string; calls: ListCall[] }[] = []
  for (const c of calls) {
    const label = c.started_at ? dayLabel(c.started_at, tz) : 'Unknown date'
    const g = groups[groups.length - 1]
    if (g?.label === label) g.calls.push(c)
    else groups.push({ label, calls: [c] })
  }

  const base = `/voix/app/${account.id}/calls`
  const href = (next: { tab?: string; q?: string; before?: string | null }) => {
    const p = new URLSearchParams()
    const t = next.tab ?? tab.key
    if (t !== 'all') p.set('tab', t)
    const qq = next.q ?? q
    if (qq) p.set('q', qq)
    if (next.before) p.set('before', next.before)
    const s = p.toString()
    return s ? `${base}?${s}` : base
  }

  const stats = [
    { label: 'Calls today', value: todayCount ?? 0 },
    { label: 'Calls, last 7 days', value: weekCount ?? 0 },
    { label: 'Booked or moved, 7 days', value: weekBooked ?? 0 },
    { label: 'Needed a person, 7 days', value: weekPerson ?? 0 },
  ]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[40px] leading-none" style={{ fontFamily: 'var(--voix-serif), Georgia, serif' }}>
            Calls
          </h1>
          <p className="mt-2 text-sm text-[#5B6070]">Every call Voix answered for {account.name}.</p>
        </div>
        <form action={base} className="flex w-full max-w-xs items-center gap-2 sm:w-auto">
          {tab.key !== 'all' ? <input type="hidden" name="tab" value={tab.key} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or phone"
            className="w-full rounded-full border border-[#ECEDF1] bg-white px-4 py-2 text-sm outline-none focus:border-[#3355D6]"
          />
        </form>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#ECEDF1] bg-white px-4 py-3.5">
            <div className="text-[26px] font-semibold leading-none tracking-tight">{s.value}</div>
            <div className="mt-1.5 text-xs text-[#5B6070]">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={href({ tab: t.key, before: null })}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              t.key === tab.key ? 'border-[#1B2236] bg-[#1B2236] text-white' : 'border-[#ECEDF1] bg-white text-[#4A5061] hover:border-[#D5D8E0]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {calls.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D5D8E0] bg-white px-6 py-16 text-center">
          <p className="text-[15px] font-medium">{q || tab.key !== 'all' ? 'No calls match.' : 'No calls yet.'}</p>
          <p className="mt-1 text-sm text-[#5B6070]">
            {q || tab.key !== 'all'
              ? 'Try another filter or search.'
              : 'Calls show up here within a minute of hanging up.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#5B6070]">{g.label}</h2>
              <ul className="divide-y divide-[#ECEDF1] overflow-hidden rounded-2xl border border-[#ECEDF1] bg-white">
                {g.calls.map((c) => {
                  const fup = fupByCall.get(c.id)
                  return (
                    <li key={c.id}>
                      <Link
                        href={`${base}/${c.id}`}
                        className="flex items-start gap-4 px-4 py-3.5 transition hover:bg-[#F9FAFB] sm:items-center"
                      >
                        <div className="w-16 shrink-0 pt-0.5 text-sm tabular-nums text-[#5B6070] sm:pt-0">
                          {formatTime(c.started_at, tz)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-[15px] font-medium">
                              {c.caller_name || formatPhone(c.from_number)}
                            </span>
                            {c.caller_name ? (
                              <span className="text-sm text-[#5B6070]">{formatPhone(c.from_number)}</span>
                            ) : null}
                            {c.urgent ? (
                              <span className="rounded-full bg-[#FDECEC] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#A12B2B]">
                                Urgent
                              </span>
                            ) : null}
                            {c.is_sample ? (
                              <span className="rounded-full border border-dashed border-[#D5D8E0] px-2 py-0.5 text-[11px] text-[#5B6070]">
                                Sample
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-sm text-[#4A5061] sm:line-clamp-1">
                            {c.summary || (c.status === 'ongoing' ? 'Call in progress…' : 'Summary coming…')}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2 sm:hidden">
                            <OutcomeBadge outcome={c.outcome} status={c.status} />
                            {fup && fup !== 'done' ? <span className="text-xs text-[#8A5A00]">Follow-up open</span> : null}
                          </div>
                        </div>
                        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                          <OutcomeBadge outcome={c.outcome} status={c.status} />
                          <span className="text-xs text-[#5B6070]">
                            {formatDuration(c.duration_sec)}
                            {fup ? ` · ${fup === 'done' ? 'Follow-up done' : 'Follow-up open'}` : ''}
                          </span>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {nextBefore ? (
        <div className="mt-6 text-center">
          <Link
            href={href({ before: nextBefore })}
            className="inline-block rounded-full border border-[#D5D8E0] bg-white px-5 py-2 text-sm font-medium"
          >
            Older calls
          </Link>
        </div>
      ) : null}
    </div>
  )
}
