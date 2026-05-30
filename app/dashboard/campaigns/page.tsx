import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { Plus } from 'lucide-react'

type Campaign = {
  id: string
  title: string
  mode: string
  segment: string | null
  status: string
  created_at: string
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    active:    { bg: '#f0fdf4', text: '#16a34a' },
    paused:    { bg: '#fffbeb', text: '#ca8a04' },
    completed: { bg: '#eff6ff', text: '#2563eb' },
    archived:  { bg: '#f9fafb', text: '#9ca3af' },
  }
  const c = colors[status] ?? colors.active
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>
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
    .select('id, title, mode, segment, status, created_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  if (error) console.error('[campaigns] fetch error:', error.message)

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-4xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#c8522a] mb-2">Campaigns</p>
          <h1 className="text-2xl font-bold text-gray-900">My campaigns</h1>
          <p className="text-gray-500 text-sm mt-1">
            {campaigns?.length
              ? `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'}`
              : 'No campaigns yet'}
          </p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="flex-shrink-0 flex items-center gap-1.5 bg-[#0a0a0a] text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors mt-1"
        >
          <Plus size={13} /> New campaign
        </Link>
      </div>

      {!campaigns?.length ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-sm text-gray-400 mb-4">You haven&apos;t built a campaign yet.</p>
          <Link
            href="/dashboard/campaigns/new"
            className="inline-flex items-center gap-1.5 bg-[#0a0a0a] text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <Plus size={13} /> Build your first campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(campaigns as Campaign[]).map(campaign => (
            <Link key={campaign.id} href={`/dashboard/campaigns/${campaign.id}`}>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-300 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#c8522a] capitalize">
                    {campaign.mode === 'guided'
                      ? (campaign.segment?.replace(/_/g, ' ') ?? 'Guided')
                      : 'Custom campaign'}
                  </span>
                  <StatusBadge status={campaign.status} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm leading-snug">{campaign.title}</h3>
                <p className="text-xs text-gray-400">
                  Created {formatDate(campaign.created_at)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
