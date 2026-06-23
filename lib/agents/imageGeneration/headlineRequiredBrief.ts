import type { ImageGenerationModelId } from './imageModelCatalog'
import type { TextQaIssue } from './types'

const TEXTLESS_STOCK_BRIEF_PATTERNS = [
  /\beditorial photograph\b/i,
  /\bcinematic scene\b/i,
  /\bshallow depth of field\b/i,
  /\bhands (?:at work|on (?:a )?(?:laptop|keyboard|tablet))\b/i,
  /\benvironmental (?:portrait|wide shot)\b/i,
  /\bauthentic (?:business|candid) (?:moment|scene|photograph)\b/i,
  /\bmetaphorizes\b/i,
  /\babsolutely no text\b/i,
  /\bno text, typography\b/i,
]

export function modelRequiresOnImageHeadline(modelId: ImageGenerationModelId): boolean {
  return modelId !== 'photoreal'
}

/** Non-photoreal briefs steered toward textless stock editorial — not social post graphics. */
export function detectTextlessStockBrief(
  brief: string,
  modelId: ImageGenerationModelId,
): TextQaIssue | null {
  if (!modelRequiresOnImageHeadline(modelId)) return null

  const hasQuotedHeadline = /["'][^"']{8,}["']/.test(brief)
  if (hasQuotedHeadline) return null

  for (const pattern of TEXTLESS_STOCK_BRIEF_PATTERNS) {
    if (pattern.test(brief)) {
      return {
        code: 'brief_textless_stock',
        message: 'Brief describes a textless editorial stock photo — social post images need a quoted on-image headline.',
      }
    }
  }

  return null
}

/** Post-render: image has no readable headline (textless stock output). */
export function detectMissingOnImageHeadline(
  transcription: string | null | undefined,
  brandNames: string[] = [],
): TextQaIssue[] {
  const text = transcription?.trim()
  if (!text) {
    return [{
      code: 'missing_headline',
      message: 'Image has no readable on-image headline — social post graphics need headline text.',
    }]
  }

  let stripped = text
  for (const brand of brandNames) {
    if (brand.length >= 3) {
      stripped = stripped.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    }
  }
  stripped = stripped.replace(/\s+/g, ' ').trim()

  const hasHeadlineLine = stripped.split(/\n+/).some(line => {
    const words = line.trim().split(/\s+/).filter(Boolean)
    return line.trim().length >= 12 && words.length >= 2
  })

  if (!hasHeadlineLine && stripped.length < 20) {
    return [{
      code: 'missing_headline',
      message: 'Image has no readable on-image headline — social post graphics need headline text.',
    }]
  }

  return []
}
