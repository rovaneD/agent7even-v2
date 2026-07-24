/** Thread 7 Layer 2 — Maya form fill proposals with user Apply gate. */

import { normalizeWebsiteUrl, websiteHost } from '@/lib/maya/canonicalWebsite'

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
  /** Saved profile website — Maya must not swap TLDs (e.g. .ai → .com). */
  canonicalWebsite?: string | null
}

export type FormPatchResult = {
  cleanText: string
  patch: Record<string, string> | null
}

const PATCH_FENCE = /```maya-form-patch\s*\n([\s\S]*?)\n```/i
const PATCH_FENCE_START = /```maya-form-patch[\s\S]*$/i
/** Unfenced patch JSON Maya sometimes emits without the code fence. */
const UNFENCED_PATCH_JSON = /\{"fields"\s*:\s*\{[\s\S]*\}\s*\}\s*$/
const UNFENCED_PATCH_START = /\{"fields"\s*:\s*\{[\s\S]*$/

/** Remove form-patch blocks from chat display — including partial streams. */
export function stripFormPatchForDisplay(text: string): string {
  let out = text.replace(PATCH_FENCE, '')
  out = out.replace(PATCH_FENCE_START, '')
  out = out.replace(UNFENCED_PATCH_START, '')
  return out.trim()
}

function parsePatchFields(raw: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(raw.trim()) as { fields?: Record<string, unknown> }
    if (!parsed.fields || typeof parsed.fields !== 'object') return null
    const patch: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed.fields)) {
      if (typeof value === 'string' && value.trim()) {
        patch[key] = value.trim()
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        patch[key] = String(value)
      }
    }
    return Object.keys(patch).length ? patch : null
  } catch {
    return null
  }
}

export function extractFormPatch(text: string): FormPatchResult {
  const cleanText = stripFormPatchForDisplay(text)

  const fenced = text.match(PATCH_FENCE)
  if (fenced) {
    const patch = parsePatchFields(fenced[1])
    return { cleanText, patch }
  }

  const unfenced = text.match(UNFENCED_PATCH_JSON)
  if (unfenced) {
    const patch = parsePatchFields(unfenced[0])
    return { cleanText, patch }
  }

  return { cleanText, patch: null }
}

export function validateFormPatch(
  patch: Record<string, string>,
  schema: FormFieldSchema[],
  options?: { canonicalWebsite?: string | null },
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

    let value = raw.trim()
    if (!value) continue

    if (
      key === 'websiteUrl' &&
      options?.canonicalWebsite &&
      schema.some(f => f.key === 'websiteUrl')
    ) {
      const canonical = normalizeWebsiteUrl(options.canonicalWebsite)
      const normalizedValue = normalizeWebsiteUrl(value) ?? value
      const canonicalHost = websiteHost(canonical)
      const proposedHost = websiteHost(normalizedValue)
      if (canonicalHost && proposedHost && canonicalHost !== proposedHost) {
        errors.push(
          `Website URL must stay ${canonical ?? options.canonicalWebsite} (saved on your profile)`,
        )
        continue
      }
      if (canonical && (!value || !proposedHost)) {
        value = canonical
      } else if (normalizedValue) {
        value = normalizedValue
      }
    }

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

export function buildFormActuationSystemSection(
  snapshot: FormSurfaceSnapshot,
  options?: { foundationHub?: boolean },
): string {
  const fieldLines = snapshot.fields.map(field => {
    const value = field.value.trim()
    const current = value ? `current="${value.replace(/"/g, "'")}"` : 'empty'
    const options = field.type === 'select' && field.options?.length
      ? ` options: ${field.options.join(' | ')}`
      : ''
    return `- ${field.key} (${field.label}) [${field.type}${options}] — ${current}`
  })

  const canonical = snapshot.canonicalWebsite
    ? normalizeWebsiteUrl(snapshot.canonicalWebsite) ?? snapshot.canonicalWebsite.trim()
    : null
  const canonicalLine = canonical
    ? `\nCANONICAL WEBSITE (profile — authoritative): ${canonical}
For websiteUrl: use this exact domain/URL. Never substitute a different TLD (e.g. do not change .ai to .com). Leave websiteUrl out of the patch if the form already shows this URL.`
    : ''

  const intro = options?.foundationHub
    ? `FORM ACTUATION — Foundation Hub (user is on the Intelligence overview):
Form: ${snapshot.label} (id: ${snapshot.id})
Editable Foundation fields from sections that need attention:
`
    : `FORM ACTUATION — open form on screen:
Form: ${snapshot.label} (id: ${snapshot.id})
Fields:
`

  return `
${intro}${fieldLines.join('\n')}${canonicalLine}

When the user asks to fill, improve, or update Foundation answers (especially for weak sections):
1. Give a brief plain-text reply (1-3 sentences). Do NOT say you already applied changes.
2. Never tell them to copy-paste into a field manually or click Save changes — Apply saves automatically.
3. Propose values only for empty fields, weak fields they asked about, or fields they explicitly asked to change.
4. End your reply with this exact fenced block (valid JSON only):

\`\`\`maya-form-patch
{"fields":{"fieldKey":"proposed value"}}
\`\`\`

Rules: only use keys listed above; plain text values; for select fields use an exact option value.
If the user is not asking to fill or update Foundation fields, do not include the block.`
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
