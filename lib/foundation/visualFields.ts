/** Your Look section — shared by Foundation hub UI and Maya page context. */
export const FOUNDATION_VISUAL_FIELDS = [
  {
    key: 'visualAesthetic',
    label: 'How should your brand look?',
    mayaHint: 'Overall look and mood — clean, warm, premium, etc. Not colors-first.',
  },
  {
    key: 'visualCasting',
    label: 'People in your visuals',
    mayaHint: 'Who appears — real owners, teams, candid action — or "no people".',
  },
  {
    key: 'visualHeroSubjects',
    label: 'What should show in imagery',
    mayaHint: 'Concrete subjects: product UI, workspace, customers in context.',
  },
  {
    key: 'visualPaletteWords',
    label: 'Colors in words (no hex)',
    mayaHint: 'Descriptive palette only — e.g. soft blue accent, warm white. No hex codes.',
  },
  {
    key: 'visualMustNotDepict',
    label: 'Never show in visuals',
    mayaHint: 'Visual anti-patterns — stock handshakes, fake dashboards, etc.',
  },
] as const

export type FoundationVisualFieldKey = (typeof FOUNDATION_VISUAL_FIELDS)[number]['key']

export function formatVisualFieldsForMaya(
  answers: Record<string, unknown>,
  fieldScores?: Record<string, { score?: number; feedback?: string | null }>,
): string[] {
  return FOUNDATION_VISUAL_FIELDS.map((field, i) => {
    const raw = answers[field.key]
    const value =
      typeof raw === 'string' && raw.trim()
        ? raw.trim()
        : '(empty — help user fill this next)'
    const score = fieldScores?.[field.key]?.score
    const scoreBit = score != null ? ` · score ${score}%` : ''
    return `Field ${i + 1}/${FOUNDATION_VISUAL_FIELDS.length}: "${field.label}" (${field.key})${scoreBit} — ${value}`
  })
}
