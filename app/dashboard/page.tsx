import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import CanvasContextDispatcher from '@/components/maya/CanvasContextDispatcher'
import MorningDigest from '@/components/dashboard/MorningDigest'
import GettingStarted from '@/components/dashboard/GettingStarted'

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  const profile = profileRows?.[0] ?? null

  if (!profile?.foundation_complete) {
    redirect('/foundation')
  }

  const today = new Date().toISOString().split('T')[0]

  const [digestResult, campaignResult, agentResult, brandKitResult] = await Promise.all([
    profile
      ? supabase
          .from('daily_digests')
          .select('id, agent_runs, approvals, today_actions, dismissed')
          .eq('user_id', profile.id)
          .eq('date', today)
          .limit(1)
      : Promise.resolve({ data: null }),

    profile
      ? supabase
          .from('campaigns')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
      : Promise.resolve({ count: 0 }),

    profile
      ? supabase
          .from('agent_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('status', 'completed')
      : Promise.resolve({ count: 0 }),

    profile
      ? supabase
          .from('brand_kit_sections')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
      : Promise.resolve({ count: 0 }),
  ])

  const digest = digestResult.data?.[0] ?? null

  const checklistCompleted: boolean[] = [
    !!profile?.foundation_complete,
    (campaignResult.count ?? 0) > 0,
    (agentResult.count ?? 0) > 0,
    (brandKitResult.count ?? 0) > 0,
    !!(profile as Record<string, unknown>)?.ga_connected || !!(profile as Record<string, unknown>)?.meta_connected,
  ]

  const gettingStartedDismissed = !!(profile as Record<string, unknown>)?.getting_started_dismissed

  const displayName = profile?.company_name || profile?.full_name || 'there'
  const firstName   = profile?.full_name?.split(' ')[0] ?? undefined
  const hasPlan = !!profile?.plan

  // Quick stats
  const activeCampaigns  = campaignResult.count ?? 0
  const agentsRunThisWeek = agentResult.count ?? 0
  const creditBalance = 0 // placeholder — fetched client-side via CreditBalance component

  const contextString = `DASHBOARD PAGE
Company: ${displayName}
Plan: ${profile?.plan ?? 'none'}
The user is on their main dashboard overview.
${!hasPlan ? 'No active plan — user needs to choose a plan to unlock agents and campaigns.' : `Plan is active: ${profile.plan}.`}`

  return (
    <div className="px-8 py-8 max-w-5xl">
      <CanvasContextDispatcher context={contextString} />

      {profile && (
        <MorningDigest
          digest={digest}
          profileId={profile.id}
          firstName={firstName}
        />
      )}

      <GettingStarted
        completed={checklistCompleted}
        dismissed={gettingStartedDismissed}
      />

      {/* Page header */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9BA1AE] mb-1">Dashboard</p>
        <h1 className="text-2xl font-semibold text-[#2D3748]">Welcome back, {displayName}.</h1>
        {!hasPlan && (
          <p className="text-sm text-[#9BA1AE] mt-1">
            You are on a free account.{' '}
            <Link href="/dashboard/billing" className="text-[#3B82F6] font-medium hover:underline">
              Choose a plan
            </Link>{' '}
            to unlock agents and campaigns.
          </p>
        )}
        {hasPlan && (
          <p className="text-sm text-[#9BA1AE] mt-1">Here is what is happening with your business.</p>
        )}
      </div>

      {/* Workspace summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-5">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9BA1AE] mb-3">Active campaigns</p>
          <p className="text-3xl font-semibold text-[#2D3748] mb-1">{activeCampaigns > 0 ? activeCampaigns : '—'}</p>
          <Link href="/dashboard/campaigns" className="text-xs text-[#3B82F6] font-medium hover:underline flex items-center gap-1 mt-1">
            View all <ArrowRight size={10} />
          </Link>
        </div>
        <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-5">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9BA1AE] mb-3">Agents run</p>
          <p className="text-3xl font-semibold text-[#2D3748] mb-1">{agentsRunThisWeek > 0 ? agentsRunThisWeek : '—'}</p>
          <Link href="/dashboard/agents" className="text-xs text-[#3B82F6] font-medium hover:underline flex items-center gap-1 mt-1">
            View agents <ArrowRight size={10} />
          </Link>
        </div>
        <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-5">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9BA1AE] mb-3">Credits remaining</p>
          <p className="text-3xl font-semibold text-[#2D3748] mb-1">—</p>
          <Link href="/dashboard/billing" className="text-xs text-[#3B82F6] font-medium hover:underline flex items-center gap-1 mt-1">
            Top up <ArrowRight size={10} />
          </Link>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { href: '/dashboard/campaigns', label: 'Campaigns', desc: 'Build and track your marketing campaigns', cta: 'View campaigns' },
          { href: '/dashboard/agents',    label: 'Agents',    desc: 'Run automated marketing agents and review outputs', cta: 'View agents' },
          { href: '/dashboard/brand-kit', label: 'Brand Kit', desc: 'Logos, colors, fonts, voice, and templates', cta: 'View brand kit' },
          { href: '/dashboard/analytics', label: 'Analytics', desc: 'Connect your accounts and track performance', cta: 'View analytics' },
        ].map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-5 hover:border-[#9BA1AE] hover:shadow-sm transition-all group"
          >
            <p className="text-sm font-semibold text-[#2D3748] mb-1">{card.label}</p>
            <p className="text-xs text-[#9BA1AE] leading-relaxed mb-4">{card.desc}</p>
            <span className="text-xs font-medium text-[#3B82F6] flex items-center gap-1">
              {card.cta} <ArrowRight size={11} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
