import Link from 'next/link'
import { requireVoixAccount } from '@/lib/voix/access'
import { formatDateTime, formatPhone, timeAgo } from '@/lib/voix/format'
import { DONE_REASON_LABELS, REASON_LABELS, type VoixCall, type VoixFollowup } from '@/lib/voix/types'
import FollowupQuickActions from '../../_components/FollowupQuickActions'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'open', label: 'To do' },
  { key: 'snoozed', label: 'Snoozed' },
  { key: 'done', label: 'Done' },
] as const

type Row = VoixFollowup & {
  call: Pick<VoixCall, 'id' | 'caller_name' | 'from_number' | 'summary' | 'started_at' | 'treatment_interest' | 'is_sample'> | null
}

export default async function FollowupsPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>
  searchParams: Promise<{ tab?: string; mine?: string }>
}) {
  const { accountId } = await params
  const sp = await searchParams
  const { account, supabase, member } = await requireVoixAccount(accountId)
  const tz = account.timezone
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? 'open'
  const mine = sp.mine === '1' && !!member
  const nowIso = new Date().toISOString()

  let query = supabase
    .from('voix_followups')
    .select(
      '*, call:voix_calls!voix_followups_call_id_fkey(id, caller_name, from_number, summary, started_at, treatment_interest, is_sample)',
    )
    .eq('account_id', account.id)
    .limit(200)

  if (tab === 'open') {
    query = query
      .or(`status.eq.open,and(status.eq.snoozed,snoozed_until.lte.${nowIso})`)
      .order('priority', { ascending: false }) // 'urgent' > 'normal'
      .order('created_at', { ascending: true })
  } else if (tab === 'snoozed') {
    query = query.eq('status', 'snoozed').gt('snoozed_until', nowIso).order('snoozed_until', { ascending: true })
  } else {
    query = query.eq('status', 'done').order('done_at', { ascending: false })
  }
  if (mine && member) query = query.eq('assigned_member_id', member.id)

  const [{ data: rows, error }, { data: memberRows }] = await Promise.all([
    query,
    supabase.from('voix_members').select('id, full_name, email').eq('account_id', account.id),
  ])
  if (error) console.error('[voix/followups] query failed:', error.message)
  const items = (rows ?? []) as Row[]
  const memberName = new Map((memberRows ?? []).map((m) => [m.id as string, (m.full_name as string) || (m.email as string)]))

  const base = `/voix/app/${account.id}/followups`
  const href = (t: string, m: boolean) => {
    const p = new URLSearchParams()
    if (t !== 'open') p.set('tab', t)
    if (m) p.set('mine', '1')
    const s = p.toString()
    return s ? `${base}?${s}` : base
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[40px] leading-none" style={{ fontFamily: 'var(--voix-serif), Georgia, serif' }}>
          Follow-ups
        </h1>
        <p className="mt-2 text-sm text-[#5B6070]">Calls that need a person. Oldest and most urgent first.</p>
      </div>

      <div className="-mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={href(t.key, mine)}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              t.key === tab ? 'border-[#1B2236] bg-[#1B2236] text-white' : 'border-[#ECEDF1] bg-white text-[#4A5061] hover:border-[#D5D8E0]'
            }`}
          >
            {t.label}
          </Link>
        ))}
        {member ? (
          <Link
            href={href(tab, !mine)}
            className={`ml-auto whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              mine ? 'border-[#3355D6] bg-[#EAF0FF] text-[#2A47B8]' : 'border-[#ECEDF1] bg-white text-[#4A5061]'
            }`}
          >
            {mine ? '✓ ' : ''}Assigned to me
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D5D8E0] bg-white px-6 py-16 text-center">
          <p className="text-[15px] font-medium">
            {tab === 'open' ? 'All caught up.' : tab === 'snoozed' ? 'Nothing snoozed.' : 'Nothing done yet.'}
          </p>
          <p className="mt-1 text-sm text-[#5B6070]">
            {tab === 'open' ? 'New follow-ups appear here, and owners get an email.' : ''}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((f) => {
            const c = f.call
            const who = c?.caller_name || formatPhone(c?.from_number)
            return (
              <li key={f.id} className="rounded-2xl border border-[#ECEDF1] bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link href={`/voix/app/${account.id}/calls/${f.call_id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {f.priority === 'urgent' && f.status !== 'done' ? (
                        <span className="rounded-full bg-[#FDECEC] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#A12B2B]">
                          Urgent
                        </span>
                      ) : null}
                      <span className="text-[15px] font-medium">{who}</span>
                      {c?.caller_name ? <span className="text-sm text-[#5B6070]">{formatPhone(c.from_number)}</span> : null}
                      {c?.is_sample ? (
                        <span className="rounded-full border border-dashed border-[#D5D8E0] px-2 py-0.5 text-[11px] text-[#5B6070]">
                          Sample
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-medium text-[#4A5061]">
                      {REASON_LABELS[f.reason]}
                      {c?.treatment_interest ? ` · ${c.treatment_interest}` : ''}
                    </p>
                    {c?.summary ? <p className="mt-1 line-clamp-2 text-sm text-[#4A5061]">{c.summary}</p> : null}
                    <p className="mt-2 text-xs text-[#5B6070]">
                      Called {c?.started_at ? timeAgo(c.started_at) : '—'}
                      {f.assigned_member_id ? ` · ${memberName.get(f.assigned_member_id) ?? 'Assigned'}` : ' · Unassigned'}
                      {tab === 'snoozed' && f.snoozed_until ? ` · Back ${formatDateTime(f.snoozed_until, tz)}` : ''}
                      {tab === 'done' && f.done_reason ? ` · ${DONE_REASON_LABELS[f.done_reason]} ${f.done_at ? timeAgo(f.done_at) : ''}` : ''}
                    </p>
                  </Link>
                  <FollowupQuickActions
                    followupId={f.id}
                    status={tab === 'open' ? 'open' : f.status}
                    callerPhone={c?.from_number ?? null}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
