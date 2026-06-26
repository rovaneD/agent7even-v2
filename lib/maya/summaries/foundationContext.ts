import type { MayaPageContext } from '@/lib/maya/contextTypes'
import { MAYA_VOICE_RULE } from '@/lib/maya/voiceRules'
import {
  displayFieldValue,
  formatActiveFormState,
  hasDisplayValue,
  truncateForMaya,
} from '@/lib/maya/formStateContext'

export function buildFoundationEditorMayaContext(input: {
  score: number
  fieldLabels: Record<string, string>
  answers: Record<string, unknown>
  weakFields: string[]
}): MayaPageContext {
  const filled = Object.entries(input.fieldLabels)
    .filter(([key]) => hasDisplayValue(input.answers[key]))
    .map(([key, label]) => `${label}: ${truncateForMaya(displayFieldValue(input.answers[key]))}`)

  const empty = Object.entries(input.fieldLabels)
    .filter(([key]) => !hasDisplayValue(input.answers[key]))
    .map(([, label]) => label)

  const weakLines = input.weakFields.map(f => input.fieldLabels[f] ?? f)

  return {
    page: 'FOUNDATION PAGE',
    dataSource: 'live',
    activeView: {
      label: 'Foundation editor',
      state: formatActiveFormState(filled, empty),
    },
    metrics: [
      `Score: ${input.score}%`,
      ...(weakLines.length ? [`Weak areas (below 70%): ${weakLines.join('; ')}`] : []),
    ],
    affordance:
      `${MAYA_VOICE_RULE} User is editing Foundation answers on screen. Use visible field values — do not ask for information already filled in the form. Help improve weak fields and explain how Foundation feeds agents.`,
  }
}
