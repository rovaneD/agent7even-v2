import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveWorkspaceClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import * as publisher from '@/lib/social/publisher'
import {
  mapZernioInboxToUi,
  mergeInboxData,
} from '@/lib/social/zernioInboxParse'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const dateRange = searchParams.get('dateRange') ?? '30d'

  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()
  const profile = await resolveWorkspaceClerkProfile<{
    id: string
    plan: string | null
    zernio_profile_id: string | null
    zernio_profile_ids: string[] | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    created_at: string
  }>(
    supabase,
    userId,
    'id, plan, zernio_profile_id, zernio_profile_ids',
    email,
  )

  if (!profile?.plan) {
    return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })
  }

  const zernioProfileIds = (profile.zernio_profile_ids as string[] | null) ?? []
  if (profile.zernio_profile_id && !zernioProfileIds.includes(profile.zernio_profile_id)) {
    zernioProfileIds.push(profile.zernio_profile_id)
  }

  if (zernioProfileIds.length === 0) {
    return NextResponse.json({ error: 'not_connected' }, { status: 404 })
  }

  return publisher.withZernioUsageContext(
    { userId: profile.id as string, zernioProfileId: zernioProfileIds[0] },
    async () => {
  const { fromDate, toDate } = publisher.dateRangeToWindow(dateRange)
  const mappedProfiles = await Promise.all(
    zernioProfileIds.map(async (profileId, index) => {
      try {
        const volume = await publisher.getInboxSummary({ profileId, fromDate, toDate })
        if (index < zernioProfileIds.length - 1) await sleep(150)
        const conversations = await publisher.getInboxConversationAnalytics({ profileId, fromDate, toDate })
        if (index < zernioProfileIds.length - 1) await sleep(150)
        const comments = await publisher.listInboxComments({ profileId, limit: 100 })

        if (!volume) return null

        return mapZernioInboxToUi(
          { volume, comments, conversations },
          { fromDate, toDate, dateRange },
        )
      } catch (err) {
        console.error(`[zernio/inbox] Failed fetching for profile ${profileId}:`, err)
        return null
      }
    }),
  )

  const valid = mappedProfiles.filter((item): item is NonNullable<typeof item> => item !== null)
  if (valid.length === 0) {
    return NextResponse.json(
      { error: 'zernio_api_error', detail: 'Could not load inbox analytics.' },
      { status: 502 },
    )
  }

  const inbox = mergeInboxData(valid)

  return NextResponse.json(
    { inbox, fromDate, toDate, dateRange },
    { headers: { 'Cache-Control': 'no-store' } },
  )
    },
  )
}
