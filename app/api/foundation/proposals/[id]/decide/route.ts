import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardProfileForClerkUser } from '@/lib/profiles/getDashboardProfile'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'
import { decideFoundationProposal } from '@/lib/foundation/proposals/decideProposal'
import type { FoundationProposalDecision } from '@/lib/foundation/proposals/types'

const VALID_DECISIONS = new Set<Exclude<FoundationProposalDecision, 'pending'>>([
  'approved',
  'rejected',
  'deferred',
])

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const decision = body.decision as FoundationProposalDecision
    const note = typeof body.note === 'string' ? body.note : undefined

    if (!VALID_DECISIONS.has(decision as Exclude<FoundationProposalDecision, 'pending'>)) {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const profile = await getDashboardProfileForClerkUser(supabase, userId)

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const workspaceProfileId = await resolveWorkspaceProfileId(supabase, profile.id)

    const result = await decideFoundationProposal(supabase, {
      proposalId: id,
      workspaceProfileId,
      decision: decision as Exclude<FoundationProposalDecision, 'pending'>,
      note,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ ok: true, layerId: result.layerId ?? null })
  } catch (err) {
    console.error('[foundation/proposals decide]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
