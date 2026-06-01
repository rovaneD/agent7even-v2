import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { Plus, Megaphone } from 'lucide-react'
import CanvasContextDispatcher from '@/components/maya/CanvasContextDispatcher'

type Campaign = {
  id: string
  title: string
  mode: string
  segment: string | null
  status: string
  created_at: string
}

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  active:    { bg: '#ECFDF5', text: '#10B981' },
  paused:    { bg: '#FFFBEB', text: '#F59E0B' },
  completed: { bg: '#EFF6FF', text: '#3B82F6' },
  archived:  { bg: '#F8FAFC', text: '#64748B' },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_BADGES[status] ?? STATUS_BADGES.active
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, border: 'none' }}>
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

  const campaignLines = campaigns?.length
    ? (campaigns as Campaign[]).map(c => `- ${c.title} (mode: ${c.mode}, status: ${c.status})`).join('\n')
    : '- No campaigns yet'

  const contextString = `CAMPAIGNS PAGE
Total campaigns: ${campaigns?.length ?? 0}
Campaigns:
${campaignLines}
The user can create new campaigns or view existing ones.`

  return (
    <div className="px-8 py-8">
      <CanvasContextDispatcher context={contextString} />

      {/* Page header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#64748B] mb-1">Campaigns</p>
          <h1 className="text-2xl font-semibold text-[#2D3748]">My campaigns</h1>
          {campaigns?.length ? (
            <p className="text-sm text-[#64748B] mt-1">
              {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}
            </p>
          ) : (
            <p className="text-sm text-[#64748B] mt-1">No campaigns yet</p>
          )}
        </div>
        {!!campaigns?.length && (
          <Link
            href="/dashboard/campaigns/new"
            className="flex-shrink-0 flex items-center gap-1.5 bg-[#2D3748] text-white text-[15px] font-medium px-4 py-2.5 rounded-xl hover:bg-[#1E293B] transition-colors mt-1"
          >
            <Plus size={13} /> New campaign
          </Link>
        )}
      </div>

      {!campaigns?.length ? (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="w-12 h-12 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-4">
            <Megaphone className="w-5 h-5 text-[#64748B]" />
          </div>
          <h3 className="font-semibold text-[#2D3748] mb-1">No campaigns yet</h3>
          <p className="text-sm text-[#64748B] mb-6 text-center max-w-xs">
            Build your first campaign and Maya will create a complete week-by-week marketing plan for you.
          </p>
          <Link
            href="/dashboard/campaigns/new"
            className="flex items-center gap-1.5 bg-[#2D3748] text-white text-[15px] font-medium px-5 py-2.5 rounded-xl hover:bg-[#1E293B] transition-colors"
          >
            <Plus size={13} /> Build your first campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(campaigns as Campaign[]).map(campaign => (
            <Link key={campaign.id} href={`/dashboard/campaigns/${campaign.id}`}>
              <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-5 hover:border-[#64748B] hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#64748B] capitalize">
                    {campaign.mode === 'guided'
                      ? (campaign.segment?.replace(/_/g, ' ') ?? 'Guided')
                      : 'Custom campaign'}
                  </span>
                  <StatusBadge status={campaign.status} />
                </div>
                <h3 className="font-semibold text-[#2D3748] mb-1 text-sm leading-snug">{campaign.title}</h3>
                <p className="text-xs text-[#64748B]">Created {formatDate(campaign.created_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
