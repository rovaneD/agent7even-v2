import type { GuardianEvaluation, GuardianState, ObserverCandidate } from '@/lib/foundation/observer/types'

export function stripJsonFence(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i)
  if (fenced) return fenced[1].trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)
  return trimmed
}

const VALID_STATES: GuardianState[] = ['consistent', 'extending', 'contradicting']

export function parseGuardianEvaluation(raw: string): GuardianEvaluation {
  const parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>

  const state = parsed.state
  if (typeof state !== 'string' || !VALID_STATES.includes(state as GuardianState)) {
    throw new Error(`Invalid Guardian state: ${String(state)}`)
  }

  const proposal_title = String(parsed.proposal_title ?? '').trim()
  const proposal_body = String(parsed.proposal_body ?? '').trim()
  const phase1_excerpt = String(parsed.phase1_excerpt ?? '').trim()
  const rationale = String(parsed.rationale ?? '').trim()

  if (!proposal_title || !proposal_body) {
    throw new Error('Guardian response missing proposal_title or proposal_body')
  }

  return {
    state: state as GuardianState,
    proposal_title,
    proposal_body,
    phase1_excerpt,
    rationale,
  }
}

export function buildGuardianSystemPrompt(phase1Bundle: string): string {
  return `You are Foundation Guardian — the verification agent for Agent7even.

Your ONLY reference frame is Phase 1 Foundation below. You do NOT learn from Observer observations except as structured candidate proposals in the user message.

For each candidate proposal:
1. Assign state:
   - consistent — restates or sharpens Phase 1 with new decision evidence
   - extending — adds nuance Phase 1 did not say but does NOT conflict
   - contradicting — conflicts with Phase 1 positioning, voice, or goals
2. Write proposal_title (short headline for future user review)
3. Write proposal_body (2–4 sentences, plain language, no markdown headers)
4. Quote phase1_excerpt — the specific Phase 1 phrase you checked against
5. Write rationale — one sentence on why you chose the state

RULES:
- Never propose silent Foundation edits.
- Never merge Observer speculation into Phase 1.
- Output JSON only — no prose outside the JSON object.

Schema:
{"state":"consistent|extending|contradicting","proposal_title":"...","proposal_body":"...","phase1_excerpt":"...","rationale":"..."}

---

${phase1Bundle}`
}

export function buildGuardianUserMessage(candidate: ObserverCandidate): string {
  return `Verify this candidate proposal against Phase 1 only.

Candidate (structured — not raw changelog):
${JSON.stringify(
  {
    theme: candidate.theme,
    statement: candidate.statement,
    supporting_summaries: candidate.supporting_summaries,
    suggested_layer_hint: candidate.suggested_layer_hint,
    supporting_count: candidate.changelog_ids.length,
  },
  null,
  2,
)}`
}
