/** Compact activeView.state for open forms — matches Agent Command Center pattern. */

export function truncateForMaya(text: string, max = 120): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export function hasDisplayValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(v => String(v ?? '').trim())
  if (typeof value === 'string') return value.trim().length > 0
  return false
}

export function displayFieldValue(value: unknown): string {
  if (Array.isArray(value)) {
    const filled = value.map(v => String(v ?? '').trim()).filter(Boolean)
    return filled.length ? filled.join(', ') : ''
  }
  if (typeof value === 'string') return value.trim()
  return ''
}

export function formatActiveFormState(
  filled: string[],
  empty: string[],
  emptyPrefix = 'Empty on screen',
): string {
  if (filled.length === 0 && empty.length) {
    return `Form open — nothing filled yet (${empty.join(', ')})`
  }
  const tail = empty.length ? ` · ${emptyPrefix}: ${empty.join(', ')}` : ''
  return `${filled.join(' · ')}${tail}`
}
