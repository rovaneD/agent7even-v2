import type { MayaPageContext } from '@/lib/maya/contextTypes'
import { MAYA_VOICE_RULE } from '@/lib/maya/voiceRules'

export function buildFoundationEditorMayaContext(input: {
  score: number
  fieldLabels: Record<string, string>
  answers: Record<string, unknown>
  weakFields: string[]
}): MayaPageContext {
  const display = (v: unknown): string => {
    if (Array.isArray(v)) {
      const filled = v.filter(Boolean)
      return filled.length ? filled.map(String).join(', ') : '(not filled in)'
    }
    if (typeof v === 'string') return v.trim() ? v.trim() : '(not filled in)'
    return '(not filled in)'
  }

  const answerLines = Object.entries(input.fieldLabels).map(
    ([k, label]) => `${label}: ${display(input.answers[k])}`,
  )
  const weakLines = input.weakFields.map(f => input.fieldLabels[f] ?? f)

  return {
    page: 'FOUNDATION PAGE',
    dataSource: 'live',
    metrics: [
      `Score: ${input.score}%`,
      ...answerLines.slice(0, 18),
      ...(weakLines.length ? [`Weak areas (below 70%): ${weakLines.join('; ')}`] : []),
    ],
    affordance: `${MAYA_VOICE_RULE} User is editing Foundation answers. Help improve weak fields and explain how Foundation feeds agents.`,
  }
}
