import type { SupabaseClient } from '@supabase/supabase-js'
import type { FoundationProposalDecision } from '@/lib/foundation/proposals/types'
import type { GuardianState } from '@/lib/foundation/observer/types'

export type DecideFoundationProposalInput = {
  proposalId: string
  workspaceProfileId: string
  decision: Exclude<FoundationProposalDecision, 'pending'>
  note?: string
}

export type DecideFoundationProposalResult =
  | { ok: true; layerId?: string }
  | { ok: false; error: string; status: number }

type DecisionUpdateResult =
  | { ok: true }
  | { ok: false; error: string; status: number }

function layerStateForProposal(state: GuardianState): 'consistent' | 'extending' {
  return state === 'consistent' ? 'consistent' : 'extending'
}

async function updateProposalDecision(
  supabase: SupabaseClient,
  input: DecideFoundationProposalInput,
  decidedAt: string,
): Promise<DecisionUpdateResult> {
  const { data, error } = await supabase
    .from('foundation_proposals')
    .update({
      user_decision: input.decision,
      decided_at: decidedAt,
      decision_note: input.note?.trim() || null,
    })
    .eq('id', input.proposalId)
    .eq('profile_id', input.workspaceProfileId)
    .or('user_decision.is.null,user_decision.eq.pending')
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, status: 500, error: error.message }
  }

  if (!data) {
    return { ok: false, status: 409, error: 'This proposal was already decided' }
  }

  return { ok: true }
}

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

  if (input.decision !== 'approved') {
    const updateResult = await updateProposalDecision(supabase, input, decidedAt)
    return updateResult.ok ? { ok: true } : updateResult
  }

  const { data: layer, error: layerError } = await supabase
    .from('foundation_layers')
    .insert({
      profile_id: input.workspaceProfileId,
      source_proposal_id: proposal.id,
      state: layerStateForProposal(proposal.state as GuardianState),
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

  const updateResult = await updateProposalDecision(supabase, input, decidedAt)
  if (!updateResult.ok) {
    const { error: cleanupError } = await supabase
      .from('foundation_layers')
      .delete()
      .eq('id', layer.id)

    if (cleanupError) {
      console.error('[foundation/proposals decide] layer cleanup failed:', cleanupError.message)
    }

    return updateResult
  }

  return { ok: true, layerId: layer.id }
}
