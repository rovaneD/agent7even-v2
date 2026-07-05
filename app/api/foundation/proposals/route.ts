import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardProfileForClerkUser } from '@/lib/profiles/getDashboardProfile'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'
import {
  loadPendingSurfacedProposals,
  loadRecentProposalDecisions,
} from '@/lib/foundation/proposals/loadProposals'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServiceClient()
    const profile = await getDashboardProfileForClerkUser(supabase, userId)

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const workspaceProfileId = await resolveWorkspaceProfileId(supabase, profile.id)

    const [pending, recent] = await Promise.all([
      loadPendingSurfacedProposals(supabase, workspaceProfileId),
      loadRecentProposalDecisions(supabase, workspaceProfileId),
    ])

    return NextResponse.json({ pending, recent })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    if (message.includes('36_foundation_proposal_decisions')) {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    console.error('[foundation/proposals GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
