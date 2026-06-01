import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  ShoppingBag,
  BarChart2,
  ArrowRight,
  Clock,
  FileText,
  CheckCircle,
} from 'lucide-react'
import PlanBanner from './PlanBanner'
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

  // Fetch digest + checklist data in parallel
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

  const contextString = `DASHBOARD PAGE
Company: ${displayName}
Plan: ${profile?.plan ?? 'none'}
The user is on their main dashboard overview.
${!hasPlan ? 'No active plan — user needs to choose a plan to unlock agents and campaigns.' : `Plan is active: ${profile.plan}.`}`

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl">
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

      <div className="mb-8">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#c8522a] mb-2">Dashboard</p>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {displayName}.</h1>
        <p className="text-gray-500 text-sm mt-1">Here&apos;s what&apos;s happening with your business.</p>
      </div>

      {!hasPlan && (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6">
          <p className="text-sm text-gray-600">
            You&apos;re on a free account —{' '}
            <Link href="/dashboard/billing" className="font-medium text-black underline">
              choose a plan
            </Link>
            {' '}to unlock agents and campaigns.
          </p>
        </div>
      )}

      {hasPlan && <PlanBanner plan={profile.plan} />}

      {/* Maya entry point */}
      <Link
        href="/maya"
        className="block mb-6 rounded-2xl border border-gray-100 bg-white p-5 hover:border-gray-300 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#0a0a0a] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg font-semibold">M</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 mb-0.5">Talk to Maya</p>
            <p className="text-xs text-gray-400 leading-relaxed">Your AI marketing strategist — get a plan, create content, and act on it, all in one place.</p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-gray-400 group-hover:text-[#0a0a0a] transition-colors">
            Open <ArrowRight size={12} />
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Hours reclaimed', value: '—', sub: 'This month', icon: Clock, color: 'text-[#c8522a]', bg: 'bg-[#c8522a]/8' },
          { label: 'Content produced', value: '—', sub: 'Total pieces', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Active services', value: '—', sub: 'Running now', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-4`}>
              <card.icon size={15} className={card.color} />
            </div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-widest mb-2">{card.label}</p>
            <p className={`text-3xl font-bold ${card.color} mb-1`}>{card.value}</p>
            <p className="text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { href: '/dashboard/services', icon: ShoppingBag, label: 'Services', desc: 'Request and track your marketing services', cta: 'View services' },
          { href: '/dashboard/analytics', icon: BarChart2, label: 'Analytics', desc: 'Connect your accounts and track performance', cta: 'View analytics' },
        ].map((card) => (
          <Link key={card.href} href={card.href} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all group">
            <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center mb-4 group-hover:bg-[#c8522a]/8 transition-colors">
              <card.icon size={16} className="text-gray-400 group-hover:text-[#c8522a] transition-colors" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">{card.label}</p>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">{card.desc}</p>
            <span className="text-xs font-medium text-[#c8522a] flex items-center gap-1">{card.cta} <ArrowRight size={11} /></span>
          </Link>
        ))}
      </div>
    </div>
  )
}
