import type { SupabaseClient } from '@supabase/supabase-js'
import type { SurfacedFoundationProposal } from '@/lib/foundation/proposals/types'

type ProposalRow = {
  id: string
  state: SurfacedFoundationProposal['state']
  proposal_title: string
  proposal_body: string
  phase1_excerpt: string | null
  signal_summary: string
  theme: string | null
  rationale: string | null
  created_at: string
  user_decision: SurfacedFoundationProposal['userDecision']
}

export async function loadPendingSurfacedProposals(
  supabase: SupabaseClient,
  profileId: string,
  limit = 4,
): Promise<SurfacedFoundationProposal[]> {
  const { data, error } = await supabase
    .from('foundation_proposals')
    .select(
      'id, state, proposal_title, proposal_body, phase1_excerpt, signal_summary, theme, rationale, created_at, user_decision',
    )
    .eq('profile_id', profileId)
    .eq('guardian_verdict', 'surface')
    .eq('user_decision', 'pending')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 10))

  if (error) {
    if (error.message.includes('user_decision')) {
      throw new Error(
        'foundation_proposals.user_decision missing — run 36_foundation_proposal_decisions.sql in Supabase.',
      )
    }
    throw new Error(error.message)
  }

  return (data ?? []).map(mapProposalRow)
}

export async function loadRecentProposalDecisions(
  supabase: SupabaseClient,
  profileId: string,
  limit = 6,
): Promise<SurfacedFoundationProposal[]> {
  const { data, error } = await supabase
    .from('foundation_proposals')
    .select(
      'id, state, proposal_title, proposal_body, phase1_excerpt, signal_summary, theme, rationale, created_at, user_decision',
    )
    .eq('profile_id', profileId)
    .eq('guardian_verdict', 'surface')
    .neq('user_decision', 'pending')
    .order('decided_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(limit, 1), 20))

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapProposalRow)
}

function mapProposalRow(row: ProposalRow): SurfacedFoundationProposal {
  return {
    id: row.id,
    state: row.state,
    proposalTitle: row.proposal_title,
    proposalBody: row.proposal_body,
    phase1Excerpt: row.phase1_excerpt,
    signalSummary: row.signal_summary,
    theme: row.theme,
    rationale: row.rationale,
    createdAt: row.created_at,
    userDecision: row.user_decision ?? 'pending',
  }
}
