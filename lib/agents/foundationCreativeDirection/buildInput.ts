import type { FoundationContext } from '@/lib/agents/loadFoundationContext'
import { FIELD_EXPECTATIONS } from '@/lib/foundation/score'
import {
  computeSectionScore,
  FOUNDATION_SECTION_KEY_FIELDS,
  GENERATION_GATED_SECTIONS,
  GENERATION_SECTION_LABELS,
  type GenerationGatedSectionKey,
} from '@/lib/foundation/sections'
import type { FieldScore } from '@/lib/foundation/sectionStrength'
import { FOUNDATION_VISUAL_FIELDS } from '@/lib/foundation/visualFields'

/** Answer keys the translation layer reads — hash must cover exactly this set. */
export const CREATIVE_DIRECTION_ANSWER_SECTIONS: { title: string; keys: string[] }[] = [
  {
    title: 'Business',
    keys: ['businessDescription', 'problemSolved', 'transformation'],
  },
  {
    title: 'Customer',
    keys: ['customerWho', 'customerFrustration', 'customerTriedBefore', 'customerBuyingTrigger'],
  },
  {
    title: 'Position',
    keys: ['competitors', 'differentiator', 'differentiatorOwn'],
  },
  {
    title: 'Voice',
    keys: ['toneTraits', 'brandsAdmired', 'neverSoundLike'],
  },
  {
    title: 'Visual (Your Look)',
    keys: FOUNDATION_VISUAL_FIELDS.map(f => f.key),
  },
  {
    title: 'Plan',
    keys: ['marketingBudget', 'channels', 'monthlyGoal'],
  },
]

const DOC_ENRICHMENT_CAP = 4000

function fieldLabel(key: string): string {
  return FIELD_EXPECTATIONS[key]?.label ?? key
}

function formatAnswerValue(value: string): string {
  const trimmed = value.trim()
  return trimmed || '(empty)'
}

function buildAnswersBlock(ctx: FoundationContext): string {
  const lines: string[] = [
    '=== PRIMARY: Foundation answers (owner\'s words — trust these over documents) ===',
  ]

  for (const section of CREATIVE_DIRECTION_ANSWER_SECTIONS) {
    lines.push('', `### ${section.title}`)
    for (const key of section.keys) {
      const value = ctx.answers[key] ?? ''
      lines.push(`- ${fieldLabel(key)} (${key}): ${formatAnswerValue(value)}`)
    }
  }

  if (ctx.competitorsFreetext) {
    lines.push('', `### Competitors (answers)`, ctx.competitorsFreetext.trim())
  }

  return lines.join('\n')
}

function buildDocumentsBlock(ctx: FoundationContext): string {
  const parts: string[] = []
  let used = 0

  for (const [type, markdown] of Object.entries(ctx.documents)) {
    const text = markdown.trim()
    if (!text) continue
    const header = `\n### ${type} (enrichment only)\n`
    const budget = DOC_ENRICHMENT_CAP - used - header.length
    if (budget <= 0) break
    const excerpt = text.length > budget ? `${text.slice(0, budget)}…` : text
    parts.push(`${header}${excerpt}`)
    used += header.length + excerpt.length
  }

  if (parts.length === 0) {
    return '=== SECONDARY: Generated documents ===\n(none — answers only)'
  }

  return [
    '=== SECONDARY: Generated documents (fill gaps only — never override explicit answers) ===',
    ...parts,
  ].join('\n')
}

function buildScoresBlock(fieldScores: Record<string, FieldScore>): string {
  const lines: string[] = [
    '=== Field scores (for weakSignals — gated sections 70–84% are passing but thin) ===',
  ]

  for (const section of GENERATION_GATED_SECTIONS) {
    const avg = computeSectionScore(fieldScores, section)
    const label = GENERATION_SECTION_LABELS[section]
    if (avg == null) {
      lines.push(`- ${label}: (not scored)`)
      continue
    }
    lines.push(`- ${label}: ${avg}%`)
    for (const fieldKey of FOUNDATION_SECTION_KEY_FIELDS[section]) {
      const row = fieldScores[fieldKey]
      if (!row?.score) continue
      const feedback = row.feedback ? ` — ${row.feedback}` : ''
      lines.push(`  · ${fieldLabel(fieldKey)}: ${row.score}%${feedback}`)
    }
  }

  const visualAvg = computeSectionScore(fieldScores, 'visual')
  if (visualAvg != null) {
    lines.push(`- Your Look (visual): ${visualAvg}%`)
    for (const fieldKey of FOUNDATION_SECTION_KEY_FIELDS.visual) {
      const row = fieldScores[fieldKey]
      if (!row?.score) continue
      const feedback = row.feedback ? ` — ${row.feedback}` : ''
      lines.push(`  · ${fieldLabel(fieldKey)}: ${row.score}%${feedback}`)
    }
  }

  return lines.join('\n')
}

/** Format Foundation + scores for the translation LLM — no side effects. */
export function buildCreativeDirectionInput(
  ctx: FoundationContext,
  fieldScores: Record<string, FieldScore>,
  companyName: string,
): string {
  return [
    `Company: ${companyName || 'Unknown'}`,
    '',
    buildAnswersBlock(ctx),
    '',
    buildDocumentsBlock(ctx),
    '',
    buildScoresBlock(fieldScores),
  ].join('\n')
}

/** Sections in the 70–84 band — informational for tests and tuning. */
export function listThinGatedSections(
  fieldScores: Record<string, FieldScore>,
): { section: GenerationGatedSectionKey; score: number }[] {
  return GENERATION_GATED_SECTIONS.flatMap(section => {
    const score = computeSectionScore(fieldScores, section)
    if (score == null || score < 70 || score > 84) return []
    return [{ section, score }]
  })
}
