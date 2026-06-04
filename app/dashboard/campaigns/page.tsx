import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { Plus, Megaphone, ArrowRight, Sparkles } from 'lucide-react'
import CanvasContextDispatcher from '@/components/maya/CanvasContextDispatcher'

type Campaign = {
  id: string
  title: string
  mode?: string | null
  segment?: string | null
  plan?: { mode?: string | null; segment?: string | null } | null
  status: string
  created_at: string
}

const STATUS_BADGES: Record<string, string> = {
  active: 'bg-status-success/10 text-status-success',
  paused: 'bg-status-warning/10 text-status-warning',
  completed: 'bg-brand-primary/10 text-brand-primary',
  archived: 'bg-surface-2 text-text-sec border border-border',
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_BADGES[status] ?? STATUS_BADGES.active
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${c}`}>
      {status}
    </span>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function CampaignsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) redirect('/sign-in')

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  if (error) console.error('[campaigns] fetch error:', error.message)

  const campaignLines = campaigns?.length
    ? (campaigns as Campaign[]).map(c => `- ${c.title} (status: ${c.status})`).join('\n')
    : '- No campaigns yet'

  const contextString = `CAMPAIGNS PAGE
Total campaigns: ${campaigns?.length ?? 0}
Campaigns:
${campaignLines}
The user can create new campaigns or view existing ones.`

  const campaignRows = (campaigns ?? []) as Campaign[]
  const activeCount = campaignRows.filter(c => c.status === 'active').length
  const latestCampaign = campaignRows[0]

  return (
    <div className="mx-auto max-w-[1240px] px-8 py-8">
      <CanvasContextDispatcher context={contextString} />

      <section className="mb-8 overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex flex-col gap-6 p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">Campaigns</p>
            <h1 className="text-[30px] font-semibold tracking-tight text-text">My campaigns</h1>
            <p className="mt-2 text-sm leading-6 text-text-sec">
              Build campaign plans, keep them organized, and turn strategy into weekly execution.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-soft">Total</p>
              <p className="mt-1 text-2xl font-semibold text-text">{campaignRows.length}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-soft">Active</p>
              <p className="mt-1 text-2xl font-semibold text-status-success">{activeCount}</p>
            </div>
            <Link
              href="/dashboard/campaigns/new"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2563EB]"
            >
              <Plus size={15} /> New campaign
            </Link>
          </div>
        </div>
        {latestCampaign && (
          <div className="border-t border-border bg-surface-2 px-7 py-4">
            <p className="text-xs text-text-sec">
              Latest campaign: <span className="font-semibold text-text">{latestCampaign.title}</span> · {formatDate(latestCampaign.created_at)}
            </p>
          </div>
        )}
      </section>

      {!campaigns?.length ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
            <Megaphone className="h-6 w-6 text-brand-primary" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-text">No campaigns yet</h3>
          <p className="mb-6 max-w-sm text-sm leading-6 text-text-sec">
            Build your first campaign and Maya will create a complete week-by-week marketing plan for you.
          </p>
          <Link
            href="/dashboard/campaigns/new"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2563EB]"
          >
            <Sparkles size={15} /> Build your first campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {campaignRows.map(campaign => (
            <Link key={campaign.id} href={`/dashboard/campaigns/${campaign.id}`}>
              <div className="group rounded-2xl border border-gray-100 bg-white p-5 transition-all hover:border-brand-primary/40 hover:bg-surface-2">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold capitalize text-text-sec">
                    {(campaign.segment ?? campaign.plan?.segment)?.replace(/_/g, ' ') ??
                      ((campaign.mode ?? campaign.plan?.mode) === 'guided' ? 'Guided' : 'Custom campaign')}
                  </span>
                  <StatusBadge status={campaign.status} />
                </div>
                <h3 className="mb-2 text-base font-semibold leading-snug text-text">{campaign.title}</h3>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-text-sec">Created {formatDate(campaign.created_at)}</p>
                  <ArrowRight size={14} className="text-text-soft transition-colors group-hover:text-brand-primary" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
