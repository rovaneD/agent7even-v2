import type { TextQaIssue } from './types'

const GENERIC_FONT_SPEC =
  /\b(inter|lora|geist|roboto|montserrat|playfair|poppins|opensans|open\s+sans|arial|helvetica|dm\s+sans|source\s+sans)\s*[,\s-]*\s*(100|200|300|400|500|600|700|800|900|regular|medium|semibold|bold)\b/gi

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Catch typography specs rendered as visible copy (e.g. "INTER 600" on the image). */
export function detectFontMetadataInImageText(
  transcription: string | null | undefined,
  brandFontFamilies: string[] = [],
): TextQaIssue[] {
  const text = transcription?.trim()
  if (!text) return []

  const issues: TextQaIssue[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(GENERIC_FONT_SPEC)) {
    const snippet = match[0].trim()
    const key = snippet.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    issues.push({
      code: 'font_spec_leak',
      message: `Font specification rendered as visible text: "${snippet}" — only marketing copy should appear on the image.`,
    })
  }

  if (/\b(font-weight|font-family|line-height|letter-spacing)\s*[:=]/i.test(text)) {
    issues.push({
      code: 'font_spec_leak',
      message: 'CSS/font metadata appears as visible text on the image.',
    })
  }

  for (const family of brandFontFamilies) {
    const trimmed = family.trim()
    if (trimmed.length < 3) continue
    const familyPattern = new RegExp(
      `\\b${escapeRegExp(trimmed)}\\s+(100|200|300|400|500|600|700|800|900|regular|medium|semibold|bold)\\b`,
      'i',
    )
    const familyMatch = text.match(familyPattern)
    if (familyMatch) {
      const snippet = familyMatch[0].trim()
      const key = snippet.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      issues.push({
        code: 'font_spec_leak',
        message: `Brand font name with weight rendered as text: "${snippet}".`,
      })
    }
  }

  return issues
}
