import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Layers,
  Megaphone,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
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

  const [digestResult, campaignResult, agentResult, brandKitResult, creditResult, approvalResult, orderResult] = await Promise.all([
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
          .not('agent', 'like', 'foundation_%')
          .neq('agent', 'maya')
      : Promise.resolve({ count: 0 }),

    profile
      ? supabase
          .from('brand_kit_sections')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
      : Promise.resolve({ count: 0 }),

    profile
      ? supabase
          .from('credit_balances')
          .select('balance')
          .eq('user_id', profile.id)
          .order('updated_at', { ascending: false })
          .limit(1)
      : Promise.resolve({ data: null }),

    profile
      ? supabase
          .from('agent_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('requires_approval', true)
          .eq('status', 'completed')
          .is('approved_at', null)
          .is('rejected_at', null)
      : Promise.resolve({ count: 0 }),

    profile
      ? supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .not('status', 'in', '(approved,completed,cancelled)')
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

  const activeCampaigns = campaignResult.count ?? 0
  const agentsRun = agentResult.count ?? 0
  const creditBalance = creditResult.data?.[0]?.balance ?? null
  const pendingApprovals = approvalResult.count ?? 0
  const activeOrders = orderResult.count ?? 0
  const foundationScore = (profile as Record<string, unknown>)?.foundation_score as number | null | undefined
  const brandKitPct = Math.round(((brandKitResult.count ?? 0) / 6) * 100)
  const analyticsConnected = !!(profile as Record<string, unknown>)?.ga_connected || !!(profile as Record<string, unknown>)?.meta_connected
  const topGoal = Array.isArray(profile?.top_goals) && profile.top_goals.length > 0 ? profile.top_goals[0] : null

  const primaryAction = !hasPlan
    ? { href: '/dashboard/billing', label: 'Choose a plan', Icon: CreditCard }
    : activeCampaigns === 0
      ? { href: '/dashboard/campaigns/new?mode=guided', label: 'Build first campaign', Icon: Megaphone }
      : pendingApprovals > 0
        ? { href: '/dashboard/agents/approvals', label: 'Review approvals', Icon: CheckCircle2 }
        : { href: '/dashboard/agents', label: 'Run an agent', Icon: Bot }
  const PrimaryActionIcon = primaryAction.Icon

  const workCards = [
    {
      href: '/dashboard/campaigns',
      label: 'Campaigns',
      desc: activeCampaigns > 0 ? 'Keep your marketing plans moving.' : 'Build your first guided 30-day plan.',
      metric: activeCampaigns > 0 ? `${activeCampaigns}` : 'Start',
      helper: activeCampaigns > 0 ? 'active' : 'guided setup',
      Icon: Megaphone,
    },
    {
      href: '/dashboard/agents',
      label: 'Agents',
      desc: 'Run specialist agents and review completed outputs.',
      metric: agentsRun > 0 ? `${agentsRun}` : '9',
      helper: agentsRun > 0 ? 'completed runs' : 'available agents',
      Icon: Bot,
    },
    {
      href: '/dashboard/brand-kit',
      label: 'Brand Kit',
      desc: 'Keep voice, visuals, and brand rules in one place.',
      metric: brandKitPct > 0 ? `${brandKitPct}%` : 'Setup',
      helper: brandKitPct > 0 ? 'complete' : 'ready',
      Icon: Layers,
    },
    {
      href: '/dashboard/analytics',
      label: 'Analytics',
      desc: analyticsConnected ? 'Performance data is connected.' : 'Connect GA or Meta to close the loop.',
      metric: analyticsConnected ? 'Live' : 'Connect',
      helper: analyticsConnected ? 'tracking' : 'recommended',
      Icon: BarChart3,
    },
  ]

  const nextMoves = [
    pendingApprovals > 0
      ? { href: '/dashboard/agents/approvals', title: 'Review pending agent output', desc: `${pendingApprovals} item${pendingApprovals === 1 ? '' : 's'} waiting for approval`, Icon: CheckCircle2 }
      : { href: '/dashboard/agents', title: 'Run a specialist agent', desc: 'Generate focused work from your Foundation context', Icon: Bot },
    activeCampaigns > 0
      ? { href: '/dashboard/calendar', title: 'Plan the next publishable asset', desc: 'Turn campaign strategy into scheduled content', Icon: CalendarDays }
      : { href: '/dashboard/campaigns/new?mode=guided', title: 'Create your first campaign', desc: 'Start with a guided 30-day marketing plan', Icon: Megaphone },
    activeOrders > 0
      ? { href: '/dashboard/services?tab=orders', title: 'Check service order progress', desc: `${activeOrders} active request${activeOrders === 1 ? '' : 's'} in motion`, Icon: FileText }
      : { href: '/dashboard/services', title: 'Use Marketing Services', desc: 'Request help or generate a self-serve asset', Icon: Sparkles },
  ]

  const contextString = `DASHBOARD PAGE
Company: ${displayName}
Plan: ${profile?.plan ?? 'none'}
The user is on their main dashboard overview.
${!hasPlan ? 'No active plan — user needs to choose a plan to unlock agents and campaigns.' : `Plan is active: ${profile.plan}.`}`

  return (
    <div className="mx-auto max-w-[1240px] px-8 py-8">
      <CanvasContextDispatcher context={contextString} />

      <section className="mb-6 overflow-hidden rounded-[24px] border border-border bg-surface shadow-[0_20px_60px_rgba(45,55,72,0.08)]">
        <div className="grid gap-0 lg:grid-cols-[1.45fr_0.9fr]">
          <div className="relative p-7">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-menu-muted">Command center</p>
            <h1 className="max-w-2xl text-[34px] font-semibold leading-tight text-text-primary">
              Welcome back, {displayName}.
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-text-sec">
              {hasPlan
                ? topGoal
                  ? `Today is about making progress on ${topGoal}. Maya has your business context ready.`
                  : 'Your workspace is ready. Pick the next highest-impact marketing move and keep momentum.'
                : 'Choose a plan to unlock agents, campaigns, and the full marketing workspace.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={primaryAction.href}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-[#2563EB]"
              >
                <PrimaryActionIcon size={16} />
                {primaryAction.label}
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/dashboard/services"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                Request service
              </Link>
            </div>
          </div>

          <div className="border-t border-border bg-surface-2 p-6 lg:border-l lg:border-t-0">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Today</p>
                <p className="mt-1 text-sm text-text-sec">Your current operating snapshot.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                <Sparkles size={18} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">Approvals</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{pendingApprovals}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">Open orders</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{activeOrders}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">Foundation</p>
                <p className="mt-2 text-2xl font-semibold text-status-success">{foundationScore ?? 'Ready'}{typeof foundationScore === 'number' ? '%' : ''}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">Credits</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{creditBalance ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <GettingStarted
            completed={checklistCompleted}
            dismissed={gettingStartedDismissed}
          />

          <section className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Next best moves</p>
                <h2 className="mt-1 text-[17px] font-semibold text-text-primary">Keep the work moving</h2>
              </div>
              <TrendingUp size={18} className="text-brand-primary" />
            </div>
            <div className="space-y-2">
              {nextMoves.map(item => {
                const ItemIcon = item.Icon
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl border border-transparent px-2 py-3 transition-colors hover:border-border hover:bg-surface-2"
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-2 text-text-sec group-hover:text-brand-primary">
                      <ItemIcon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-text-primary">{item.title}</span>
                      <span className="block text-xs leading-5 text-text-sec">{item.desc}</span>
                    </span>
                    <ArrowRight size={14} className="text-menu-muted group-hover:text-brand-primary" />
                  </Link>
                )
              })}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {profile && (
            <MorningDigest
              digest={digest}
              profileId={profile.id}
              firstName={firstName}
            />
          )}

          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Workspace</p>
                <h2 className="mt-1 text-[18px] font-semibold text-text-primary">Your marketing system</h2>
              </div>
              <Link href="/dashboard/agents" className="text-xs font-semibold text-brand-primary hover:underline">
                View agents
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {workCards.map(card => {
                const CardIcon = card.Icon
                return (
                  <Link
                    key={card.href}
                    href={card.href}
                    className="group rounded-2xl border border-gray-100 bg-white p-5 transition-all hover:border-border-strong"
                  >
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-text-sec group-hover:text-brand-primary">
                        <CardIcon size={18} />
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-semibold text-text-primary">{card.metric}</p>
                        <p className="text-[11px] text-text-muted">{card.helper}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-text-primary">{card.label}</p>
                    <p className="mt-1 min-h-[40px] text-xs leading-5 text-text-sec">{card.desc}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-primary">
                      Open <ArrowRight size={11} />
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
