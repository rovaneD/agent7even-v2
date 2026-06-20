import { createServiceClient } from '@/lib/supabase/server'
import {
  computeSectionScore,
  GENERATION_FLOOR_ROUTE,
  GENERATION_GATED_SECTIONS,
  GENERATION_SECTION_LABELS,
  weakestScoredFieldInSection,
  type FieldScoreLike,
  type GenerationGatedSectionKey,
} from './sections'

export type FieldScore = FieldScoreLike & { feedback: string | null }

/**
 * Empirical floor for image generation (handoff §3).
 * Calibrated 2026-06-20 via scripts/calibrate-generation-floor.ts:
 * - Matches Foundation hub "strong" band (≥70)
 * - Manual happy path at ~84% global (Agent7even) — grounded options + QA + compose
 * - Weak Position (~48%) blocked in live testing
 * Revisit when Observer has pick/approve/edit signal across more accounts.
 */
export const GENERATION_SECTION_FLOOR = 70

export type GenerationFloorResult =
  | { ok: true; scores: Record<GenerationGatedSectionKey, number> }
  | {
      ok: false
      reason: 'no_scores' | 'missing_section_scores' | 'below_floor'
      section: GenerationGatedSectionKey
      score: number | null
      floor: number
      route: string
      message: string
      weakField?: { fieldKey: string; feedback: string | null }
    }

export async function loadFieldScores(profileId: string): Promise<Record<string, FieldScore>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('foundation_field_scores')
    .select('field_key, score, feedback')
    .eq('user_id', profileId)

  if (error) throw new Error(`loadFieldScores: ${error.message}`)

  return Object.fromEntries(
    (data ?? []).map(row => [
      row.field_key as string,
      { score: row.score as number, feedback: (row.feedback as string | null) ?? null },
    ]),
  )
}

export function getSectionScore(
  fieldScores: Record<string, FieldScoreLike>,
  section: GenerationGatedSectionKey,
): number | null {
  return computeSectionScore(fieldScores, section)
}

/** Server-enforced hard floor for image generation (creative_generation_handoff.md §3). */
export async function assertGenerationFloor(
  profileId: string,
  floor = GENERATION_SECTION_FLOOR,
): Promise<GenerationFloorResult> {
  const fieldScores = await loadFieldScores(profileId)

  if (Object.keys(fieldScores).length === 0) {
    return {
      ok: false,
      reason: 'no_scores',
      section: 'voice',
      score: null,
      floor,
      route: GENERATION_FLOOR_ROUTE,
      message:
        'Re-score your Foundation before generating images. Open Intelligence, review your answers, and save to update your scores.',
    }
  }

  for (const section of GENERATION_GATED_SECTIONS) {
    const score = getSectionScore(fieldScores, section)
    const label = GENERATION_SECTION_LABELS[section]

    if (score === null) {
      return {
        ok: false,
        reason: 'missing_section_scores',
        section,
        score: null,
        floor,
        route: GENERATION_FLOOR_ROUTE,
        message: `Generation needs scored Foundation answers. Re-score your Foundation — the ${label} section has no scores yet.`,
      }
    }

    if (score < floor) {
      const weak = weakestScoredFieldInSection(fieldScores, section)
      const feedbackHint = weak?.feedback ? ` ${weak.feedback}` : ''
      return {
        ok: false,
        reason: 'below_floor',
        section,
        score,
        floor,
        route: GENERATION_FLOOR_ROUTE,
        message: `Generation needs a stronger ${label} profile. Your ${label} is at ${score}% (minimum ${floor}%). Strengthen it in Foundation → Intelligence.${feedbackHint}`,
        weakField: weak ? { fieldKey: weak.fieldKey, feedback: weak.feedback } : undefined,
      }
    }
  }

  const scores = Object.fromEntries(
    GENERATION_GATED_SECTIONS.map(section => [
      section,
      getSectionScore(fieldScores, section)!,
    ]),
  ) as Record<GenerationGatedSectionKey, number>

  return { ok: true, scores }
}
