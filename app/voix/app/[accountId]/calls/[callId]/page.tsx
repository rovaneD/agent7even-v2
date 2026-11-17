import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireVoixAccount } from '@/lib/voix/access'
import { formatDateTime, formatDuration, formatPhone } from '@/lib/voix/format'
import type { VoixCall, VoixFollowup, VoixFollowupEvent, VoixMember } from '@/lib/voix/types'
import OutcomeBadge from '../../../_components/OutcomeBadge'
import FollowupPanel from '../../../_components/FollowupPanel'

export const dynamic = 'force-dynamic'

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ accountId: string; callId: string }>
}) {
  const { accountId, callId } = await params
  const { account, supabase, member } = await requireVoixAccount(accountId)
  if (!/^[0-9a-f-]{36}$/i.test(callId)) notFound()
  const tz = account.timezone

  const { data: callRow } = await supabase
    .from('voix_calls')
    .select('*')
    .eq('id', callId)
    .eq('account_id', account.id)
    .maybeSingle()
  if (!callRow) notFound()
  const call = callRow as VoixCall

  const [{ data: fupRow }, { data: memberRows }, { data: history }] = await Promise.all([
    supabase.from('voix_followups').select('*').eq('call_id', call.id).maybeSingle(),
    supabase.from('voix_members').select('id, email, full_name, role').eq('account_id', account.id).order('full_name'),
    call.from_number
      ? supabase
          .from('voix_calls')
          .select('id, started_at, outcome, status')
          .eq('account_id', account.id)
          .eq('from_number', call.from_number)
          .neq('id', call.id)
          .order('started_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as Pick<VoixCall, 'id' | 'started_at' | 'outcome' | 'status'>[] }),
  ])
  const followup = (fupRow as VoixFollowup | null) ?? null
  const { data: eventRows } = followup
    ? await supabase.from('voix_followup_events').select('*').eq('followup_id', followup.id).order('created_at', { ascending: false })
    : { data: [] as VoixFollowupEvent[] }

  const members = ((memberRows ?? []) as Pick<VoixMember, 'id' | 'email' | 'full_name'>[]).map((m) => ({
    id: m.id,
    label: m.full_name || m.email,
  }))

  const turns = call.transcript_object ?? null
  const base = `/voix/app/${account.id}/calls`

  return (
    <div>
      <Link href={base} className="text-sm font-medium text-[#3355D6]">
        ← All calls
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[36px] leading-tight" style={{ fontFamily: 'var(--voix-serif), Georgia, serif' }}>
            {call.caller_name || formatPhone(call.from_number)}
          </h1>
          <p className="mt-1 text-sm text-[#5B6070]">
            {call.caller_name ? `${formatPhone(call.from_number)} · ` : ''}
            {formatDateTime(call.started_at, tz)} · {formatDuration(call.duration_sec)}
            {call.direction !== 'inbound' ? ` · ${call.direction === 'web' ? 'Web test call' : 'Outbound'}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {call.urgent ? (
            <span className="rounded-full bg-[#FDECEC] px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-[#A12B2B]">
              Urgent
            </span>
          ) : null}
          {call.is_sample ? (
            <span className="rounded-full border border-dashed border-[#D5D8E0] px-2.5 py-0.5 text-xs text-[#5B6070]">Sample</span>
          ) : null}
          <OutcomeBadge outcome={call.outcome} status={call.status} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-[#ECEDF1] bg-white p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5B6070]">Summary</h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              {call.summary || (call.status === 'analyzed' ? 'No summary for this call.' : 'The summary appears a minute after the call ends.')}
            </p>
            {call.recording_url ? (
              <audio controls preload="none" src={call.recording_url} className="mt-4 w-full">
                <a href={call.recording_url}>Download the recording</a>
              </audio>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[#ECEDF1] bg-white p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5B6070]">Transcript</h2>
            {turns?.length ? (
              <ol className="mt-4 space-y-3">
                {turns.map((t, i) => {
                  const agent = t.role === 'agent'
                  return (
                    <li key={i} className={`flex ${agent ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                          agent ? 'rounded-tl-md bg-[#F2F3F6] text-[#1B2236]' : 'rounded-tr-md bg-[#3355D6] text-white'
                        }`}
                      >
                        <div className={`mb-0.5 text-[11px] font-semibold uppercase tracking-wide ${agent ? 'text-[#5B6070]' : 'text-white/75'}`}>
                          {agent ? 'Voix' : 'Caller'}
                        </div>
                        {t.content}
                      </div>
                    </li>
                  )
                })}
              </ol>
            ) : call.transcript ? (
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-[#4A5061]">{call.transcript}</p>
            ) : (
              <p className="mt-3 text-sm text-[#5B6070]">No transcript yet.</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <FollowupPanel
            accountId={account.id}
            callId={call.id}
            callerPhone={call.from_number}
            timezone={tz}
            followup={followup}
            events={(eventRows ?? []) as VoixFollowupEvent[]}
            members={members}
            myMemberId={member?.id ?? null}
          />

          <section className="rounded-2xl border border-[#ECEDF1] bg-white p-5">
            <h2 className="text-[15px] font-semibold">Caller</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#5B6070]">Name</dt>
                <dd className="text-right">{call.caller_name || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#5B6070]">Phone</dt>
                <dd className="text-right">
                  {call.from_number ? (
                    <a href={`tel:${call.from_number.replace(/[^\d+]/g, '')}`} className="text-[#3355D6]">
                      {formatPhone(call.from_number)}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#5B6070]">Interested in</dt>
                <dd className="text-right">{call.treatment_interest || '—'}</dd>
              </div>
              {call.sentiment ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5B6070]">Mood</dt>
                  <dd className="text-right">{call.sentiment}</dd>
                </div>
              ) : null}
            </dl>
            {history?.length ? (
              <div className="mt-4 border-t border-[#ECEDF1] pt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5B6070]">Earlier calls</p>
                <ul className="mt-2 space-y-1.5">
                  {history.map((h) => (
                    <li key={h.id}>
                      <Link href={`${base}/${h.id}`} className="flex items-center justify-between gap-3 text-sm hover:text-[#3355D6]">
                        <span>{formatDateTime(h.started_at, tz)}</span>
                        <OutcomeBadge outcome={h.outcome} status={h.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  )
}
