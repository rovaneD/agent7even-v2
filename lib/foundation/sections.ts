/**
 * Single source of truth for Foundation Intelligence section → field mapping.
 * Used by FoundationHub (UI scores) and sectionStrength (generation gate).
 * v1: generation gate uses customer | position | voice only — see creative_generation_handoff.md §3b.
 */

export type FoundationScoredSectionKey = 'business' | 'customer' | 'position' | 'voice' | 'plan'

export type GenerationGatedSectionKey = 'customer' | 'position' | 'voice'

export type FieldScoreLike = { score: number; feedback?: string | null }

/** Per-section fields averaged for hub section scores and the generation hard floor. */
export const FOUNDATION_SECTION_KEY_FIELDS: Record<FoundationScoredSectionKey, string[]> = {
  business: ['businessDescription', 'problemSolved'],
  customer: ['customerWho', 'customerFrustration'],
  position: ['differentiator', 'competitors'],
  voice:    ['toneTraits', 'brandsAdmired'],
  plan:     ['marketingBudget', 'monthlyGoal'],
}

export const GENERATION_GATED_SECTIONS: GenerationGatedSectionKey[] = [
  'customer',
  'position',
  'voice',
]

export const GENERATION_SECTION_LABELS: Record<GenerationGatedSectionKey, string> = {
  customer: 'Customer',
  position: 'Position',
  voice:    'Voice',
}

/** Route users to Foundation Intelligence when blocked (hub has no section deep-link yet). */
export const GENERATION_FLOOR_ROUTE = '/dashboard/foundation'

/** Average of scored keyFields for a section; null when none of the section fields are scored. */
export function computeSectionScore(
  fieldScores: Record<string, FieldScoreLike>,
  section: FoundationScoredSectionKey | GenerationGatedSectionKey,
): number | null {
  const fields = FOUNDATION_SECTION_KEY_FIELDS[section]
  const scored = fields.filter(f => fieldScores[f]?.score != null)
  if (scored.length === 0) return null
  const avg = scored.reduce((sum, f) => sum + fieldScores[f]!.score, 0) / scored.length
  return Math.round(avg)
}

/** Lowest-scored field in a section (for actionable block messages). */
export function weakestScoredFieldInSection(
  fieldScores: Record<string, FieldScoreLike>,
  section: GenerationGatedSectionKey,
): { fieldKey: string; score: number; feedback: string | null } | null {
  const fields = FOUNDATION_SECTION_KEY_FIELDS[section]
  let weakest: { fieldKey: string; score: number; feedback: string | null } | null = null
  for (const fieldKey of fields) {
    const row = fieldScores[fieldKey]
    if (row?.score == null) continue
    if (!weakest || row.score < weakest.score) {
      weakest = { fieldKey, score: row.score, feedback: row.feedback ?? null }
    }
  }
  return weakest
}
