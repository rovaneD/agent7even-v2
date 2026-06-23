import { createHash } from 'crypto'
import type { FoundationContext } from '@/lib/agents/loadFoundationContext'
import { CREATIVE_DIRECTION_ANSWER_SECTIONS } from './buildInput'

export const CREATIVE_DIRECTION_ANSWER_KEYS = CREATIVE_DIRECTION_ANSWER_SECTIONS.flatMap(
  section => section.keys,
)

export const CREATIVE_DIRECTION_DOCUMENT_TYPES = [
  'brief',
  'icp',
  'positioning',
  'voice',
  'plan',
] as const

export function normalizeCreativeDirectionAnswerValue(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  return String(value).trim()
}

/** Stable hash of translation inputs — answers primary, documents enrichment. */
export function computeCreativeDirectionSourceHash(input: {
  answers: Record<string, unknown>
  documents?: FoundationContext['documents']
}): string {
  const answers: Record<string, string> = {}
  for (const key of CREATIVE_DIRECTION_ANSWER_KEYS) {
    answers[key] = normalizeCreativeDirectionAnswerValue(input.answers[key])
  }

  const documents: Record<string, string> = {}
  if (input.documents) {
    for (const type of CREATIVE_DIRECTION_DOCUMENT_TYPES) {
      documents[type] = (input.documents[type] ?? '').trim()
    }
  }

  return createHash('sha256')
    .update(JSON.stringify({ answers, documents }))
    .digest('hex')
}
