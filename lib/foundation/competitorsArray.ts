/** Foundation competitors are always three discrete prose slots — never comma-split. */

export const COMPETITOR_SLOT_COUNT = 3

export type CompetitorSlots = [string, string, string]

const EMPTY_SLOTS: CompetitorSlots = ['', '', '']

/** Hydrate UI/API from JSONB without splitting on in-copy punctuation. */
export function normalizeCompetitorSlots(value: unknown): CompetitorSlots {
  if (Array.isArray(value)) {
    return [
      String(value[0] ?? ''),
      String(value[1] ?? ''),
      String(value[2] ?? ''),
    ]
  }

  if (typeof value === 'string' && value.trim()) {
    // Legacy rows may store one blob as a string — keep it whole in slot 1.
    return [value.trim(), '', '']
  }

  return [...EMPTY_SLOTS]
}

/** Non-empty competitor entries in slot order. */
export function competitorEntries(value: unknown): string[] {
  return normalizeCompetitorSlots(value).map(entry => entry.trim()).filter(Boolean)
}

/** Agent-facing block — one numbered entry per slot, no comma joining. */
export function formatCompetitorsForAgent(value: unknown): string {
  const entries = competitorEntries(value)
  if (entries.length === 0) return ''
  return entries.map((entry, index) => `${index + 1}. ${entry}`).join('\n')
}

/** Persist shape: fixed 3-slot array (empty slots preserved). */
export function serializeCompetitorSlots(value: unknown): CompetitorSlots {
  return normalizeCompetitorSlots(value)
}
