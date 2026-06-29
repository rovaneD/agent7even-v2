/** Thread 7 Layer 2 — Maya form fill proposals with user Apply gate. */

export type FormFieldType = 'text' | 'textarea' | 'select'

export type FormFieldSchema = {
  key: string
  label: string
  type: FormFieldType
  options?: string[]
}

export type FormSurfaceSnapshot = {
  id: string
  label: string
  fields: Array<FormFieldSchema & { value: string }>
}

export type FormPatchResult = {
  cleanText: string
  patch: Record<string, string> | null
}

const PATCH_FENCE = /```maya-form-patch\s*\n([\s\S]*?)\n```/i

export function extractFormPatch(text: string): FormPatchResult {
  const match = text.match(PATCH_FENCE)
  if (!match) return { cleanText: text.trim(), patch: null }

  const cleanText = text.replace(PATCH_FENCE, '').trim()
  try {
    const parsed = JSON.parse(match[1].trim()) as { fields?: Record<string, unknown> }
    if (!parsed.fields || typeof parsed.fields !== 'object') {
      return { cleanText, patch: null }
    }
    const patch: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed.fields)) {
      if (typeof value === 'string' && value.trim()) {
        patch[key] = value.trim()
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        patch[key] = String(value)
      }
    }
    return { cleanText, patch: Object.keys(patch).length ? patch : null }
  } catch {
    return { cleanText, patch: null }
  }
}

export function validateFormPatch(
  patch: Record<string, string>,
  schema: FormFieldSchema[],
): { patch: Record<string, string>; errors: string[] } {
  const allowed = new Map(schema.map(field => [field.key, field]))
  const valid: Record<string, string> = {}
  const errors: string[] = []

  for (const [key, raw] of Object.entries(patch)) {
    const field = allowed.get(key)
    if (!field) {
      errors.push(`Unknown field: ${key}`)
      continue
    }

    const value = raw.trim()
    if (!value) continue

    const maxLen = field.type === 'textarea' ? 4000 : 500
    if (value.length > maxLen) {
      errors.push(`${field.label} is too long`)
      continue
    }

    if (field.type === 'select' && field.options?.length) {
      const normalized = value.toLowerCase()
      const match = field.options.find(opt => opt.toLowerCase() === normalized)
      if (!match) {
        errors.push(`${field.label} must be one of: ${field.options.join(', ')}`)
        continue
      }
      valid[key] = match
      continue
    }

    valid[key] = value
  }

  return { patch: valid, errors }
}

export function buildFormActuationSystemSection(snapshot: FormSurfaceSnapshot): string {
  const fieldLines = snapshot.fields.map(field => {
    const value = field.value.trim()
    const current = value ? `current="${value.replace(/"/g, "'")}"` : 'empty'
    const options = field.type === 'select' && field.options?.length
      ? ` options: ${field.options.join(' | ')}`
      : ''
    return `- ${field.key} (${field.label}) [${field.type}${options}] — ${current}`
  })

  return `
FORM ACTUATION — open form on screen:
Form: ${snapshot.label} (id: ${snapshot.id})
Fields:
${fieldLines.join('\n')}

When the user asks to fill, pre-fill, or complete this form (especially from Foundation):
1. Give a brief plain-text reply (1-3 sentences). Do NOT say you already applied changes.
2. Propose values only for empty fields or fields they explicitly asked to change.
3. End your reply with this exact fenced block (valid JSON only):

\`\`\`maya-form-patch
{"fields":{"fieldKey":"proposed value"}}
\`\`\`

Rules: only use keys listed above; plain text values; for select fields use an exact option value.
If the user is not asking to fill the form, do not include the block.`
}

export function diffFormPatch(
  patch: Record<string, string>,
  snapshot: FormSurfaceSnapshot,
): Array<{ key: string; label: string; from: string; to: string }> {
  const labels = new Map(snapshot.fields.map(f => [f.key, f.label]))
  const current = new Map(snapshot.fields.map(f => [f.key, f.value.trim()]))

  return Object.entries(patch)
    .filter(([key, to]) => current.get(key) !== to)
    .map(([key, to]) => ({
      key,
      label: labels.get(key) ?? key,
      from: current.get(key) || '(empty)',
      to,
    }))
}
