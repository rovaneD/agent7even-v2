import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import CampaignList from './CampaignList'

export default async function MyCampaignsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, full_name')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) redirect('/sign-in')

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, title, plan, status, created_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  if (error) console.error('[my-campaigns] fetch error:', error.message)

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-3xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#c8522a] mb-2">Campaigns</p>
          <h1 className="text-2xl font-bold text-gray-900">My campaigns</h1>
          <p className="text-gray-500 text-sm mt-1">
            {campaigns?.length
              ? `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'} saved`
              : 'No campaigns yet'}
          </p>
        </div>
        <Link
          href="/maya"
          className="flex-shrink-0 bg-[#0a0a0a] text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-gray-800 transition-colors mt-1"
        >
          + New campaign
        </Link>
      </div>

      <CampaignList campaigns={campaigns ?? []} />
    </div>
  )
}
