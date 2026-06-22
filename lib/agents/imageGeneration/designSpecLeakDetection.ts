import type { TextQaIssue } from './types'

const HEX_IN_TEXT = /#(?:[0-9A-Fa-f]{3}){1,2}\b/g
/** e.g. "2D3748 Investment" — hex leaked without # prefix */
const BARE_HEX_LABEL = /\b[0-9A-Fa-f]{6}\s+[A-Za-z][\w\s-]{0,24}/g
const BARE_HEX_TOKEN = /\b[0-9A-Fa-f]{6}\b/g

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Catch design tokens rendered as visible copy (hex swatches, color role labels). */
export function detectDesignSpecInImageText(
  transcription: string | null | undefined,
  brandColorNames: string[] = [],
): TextQaIssue[] {
  const text = transcription?.trim()
  if (!text) return []

  const issues: TextQaIssue[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(HEX_IN_TEXT)) {
    const snippet = match[0]
    const key = snippet.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    issues.push({
      code: 'design_spec_leak',
      message: `Hex color code rendered as visible text: "${snippet}" — use colors in the design, not as labels.`,
    })
  }

  for (const match of text.matchAll(BARE_HEX_LABEL)) {
    const snippet = match[0].trim()
    const key = snippet.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    issues.push({
      code: 'design_spec_leak',
      message: `Design token rendered as a label: "${snippet}" — never print hex values as copy.`,
    })
  }

  const bareHexMatches = [...text.matchAll(BARE_HEX_TOKEN)].map(m => m[0].toUpperCase())
  const uniqueBareHex = [...new Set(bareHexMatches)]
  if (uniqueBareHex.length >= 2) {
    issues.push({
      code: 'design_spec_leak',
      message: 'Multiple bare hex color codes appear as visible text on the image.',
    })
  }

  for (const name of brandColorNames) {
    const trimmed = name.trim()
    if (trimmed.length < 3) continue
    const pattern = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, 'i')
    if (pattern.test(text)) {
      const key = trimmed.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      issues.push({
        code: 'design_spec_leak',
        message: `Brand color name "${trimmed}" appears as visible text — do not print color token labels on the image.`,
      })
    }
  }

  if (/\b(strategic slate|growth green|brand orange|primary blue|color palette|hex code|rgb)\b/i.test(text)) {
    issues.push({
      code: 'design_spec_leak',
      message: 'Design-system or color-spec language appears as visible copy on the image.',
    })
  }

  return issues
}
