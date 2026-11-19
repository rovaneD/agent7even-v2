import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireVoixViewer, ACCOUNT_SELECT } from '@/lib/voix/access'
import { loadMonitor } from '@/lib/voix/monitor'
import type { VoixAccount, VoixMember } from '@/lib/voix/types'
import AdminConsole, { type PilotRequestRow } from './AdminConsole'
import MonitorView from './MonitorView'
import OutreachView from './OutreachView'
import { PROSPECT_SELECT, type ProspectRun, type VoixProspect } from '@/lib/voix/prospects'

export const dynamic = 'force-dynamic'

export default async function VoixAdminPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { viewer, supabase } = await requireVoixViewer()
  if (!viewer.isAdmin) redirect('/voix/app')
  const rawView = (await searchParams).view
  const view = rawView === 'spas' || rawView === 'outreach' ? rawView : 'monitor'

  const { data: accountRows } = await supabase.from('voix_accounts').select(ACCOUNT_SELECT).order('created_at', { ascending: true })
  const accounts = (accountRows ?? []) as VoixAccount[]
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.agent7even.ai').replace(/\/$/, '')

  let body: React.ReactNode
  if (view === 'outreach') {
    const { data: prospects } = await supabase
      .from('voix_prospects')
      .select(PROSPECT_SELECT)
      .order('next_follow_up', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    const { data: lastRun } = await supabase
      .from('voix_prospect_runs')
      .select('status, trigger, added, error, started_at, finished_at')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    body = <OutreachView prospects={(prospects ?? []) as VoixProspect[]} lastRun={(lastRun as ProspectRun | null) ?? null} />
  } else if (view === 'monitor') {
    const data = await loadMonitor(supabase, accounts)
    body = <MonitorView data={data} accountNames={Object.fromEntries(accounts.map((a) => [a.id, a.name]))} />
  } else {
    const { data: members } = await supabase
      .from('voix_members')
      .select('id, account_id, email, full_name, clerk_user_id, role, invited_at, joined_at, last_seen_at')
      .order('invited_at')
    const callCount = new Map<string, { real: number; sample: number }>()
    await Promise.all(
      accounts.map(async (a) => {
        const [{ count: real }, { count: sample }] = await Promise.all([
          supabase.from('voix_calls').select('id', { count: 'exact', head: true }).eq('account_id', a.id).eq('is_sample', false),
          supabase.from('voix_calls').select('id', { count: 'exact', head: true }).eq('account_id', a.id).eq('is_sample', true),
        ])
        callCount.set(a.id, { real: real ?? 0, sample: sample ?? 0 })
      }),
    )
    const { data: requests } = await supabase
      .from('voix_pilot_requests')
      .select('id, source, status, contact_name, spa_name, email, phone, instagram, booking_software, locations, preferred_time, notes, account_id, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    body = (
      <AdminConsole
        requests={(requests ?? []) as PilotRequestRow[]}
        accounts={accounts.map((a) => ({
          ...a,
          members: ((members ?? []) as VoixMember[]).filter((m) => m.account_id === a.id),
          calls: callCount.get(a.id) ?? { real: 0, sample: 0 },
        }))}
      />
    )
  }

  const tab = (key: 'monitor' | 'spas' | 'outreach', label: string) => (
    <Link
      href={key === 'monitor' ? '/voix/app/admin' : `/voix/app/admin?view=${key}`}
      className={`rounded-full px-4 py-2 text-sm font-medium ${
        view === key ? 'bg-[#1B2236] text-white' : 'border border-[#ECEDF1] bg-white text-[#4A5061]'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/voix/app" className="text-sm font-medium text-[#3355D6]">
            ← Voix
          </Link>
          <h1 className="mt-2 text-[40px] leading-none" style={{ fontFamily: 'var(--voix-serif), Georgia, serif' }}>
            Voix admin
          </h1>
          <p className="mt-2 text-sm text-[#5B6070]">What every pilot spa and its callers are experiencing.</p>
        </div>
        <div className="rounded-xl border border-[#ECEDF1] bg-white px-4 py-3 text-xs text-[#4A5061]">
          <div className="font-semibold text-[#1B2236]">Retell webhook URL</div>
          <code className="mt-1 block select-all">{appUrl}/api/voix/retell</code>
        </div>
      </div>
      <div className="mb-6 flex gap-2">
        {tab('monitor', 'Monitor')}
        {tab('spas', 'Spas & setup')}
        {tab('outreach', 'Outreach')}
      </div>
      {body}
    </div>
  )
}
