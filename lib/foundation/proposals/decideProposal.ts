import type { SupabaseClient } from '@supabase/supabase-js'
import type { FoundationProposalDecision } from '@/lib/foundation/proposals/types'

export type DecideFoundationProposalInput = {
  proposalId: string
  workspaceProfileId: string
  decision: Exclude<FoundationProposalDecision, 'pending'>
  note?: string
}

export type DecideFoundationProposalResult =
  | { ok: true; layerId?: string }
  | { ok: false; error: string; status: number }

export async function decideFoundationProposal(
  supabase: SupabaseClient,
  input: DecideFoundationProposalInput,
): Promise<DecideFoundationProposalResult> {
  const { data: proposal, error: loadError } = await supabase
    .from('foundation_proposals')
    .select(
      'id, profile_id, state, guardian_verdict, user_decision, proposal_title, proposal_body, theme',
    )
    .eq('id', input.proposalId)
    .maybeSingle()

  if (loadError) {
    if (loadError.message.includes('user_decision')) {
      return {
        ok: false,
        status: 503,
        error: 'Proposal decisions not enabled — run 36_foundation_proposal_decisions.sql in Supabase.',
      }
    }
    return { ok: false, status: 500, error: loadError.message }
  }

  if (!proposal || proposal.profile_id !== input.workspaceProfileId) {
    return { ok: false, status: 404, error: 'Proposal not found' }
  }

  if (proposal.guardian_verdict !== 'surface') {
    return { ok: false, status: 400, error: 'This proposal is not available for review' }
  }

  if (proposal.user_decision && proposal.user_decision !== 'pending') {
    return { ok: false, status: 409, error: 'This proposal was already decided' }
  }

  const decidedAt = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('foundation_proposals')
    .update({
      user_decision: input.decision,
      decided_at: decidedAt,
      decision_note: input.note?.trim() || null,
    })
    .eq('id', input.proposalId)

  if (updateError) {
    return { ok: false, status: 500, error: updateError.message }
  }

  if (input.decision !== 'approved') {
    return { ok: true }
  }

  const { data: layer, error: layerError } = await supabase
    .from('foundation_layers')
    .insert({
      profile_id: input.workspaceProfileId,
      source_proposal_id: proposal.id,
      state: proposal.state,
      title: proposal.proposal_title,
      body: proposal.proposal_body,
      theme: proposal.theme,
      approved_at: decidedAt,
    })
    .select('id')
    .single()

  if (layerError) {
    if (layerError.message.includes('foundation_layers')) {
      return {
        ok: false,
        status: 503,
        error: 'Foundation layers table missing — run 37_foundation_layers.sql in Supabase.',
      }
    }
    return { ok: false, status: 500, error: layerError.message }
  }

  return { ok: true, layerId: layer.id }
}
