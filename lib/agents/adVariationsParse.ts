/** Split Ad Variations markdown into copy-friendly blocks. */

export type AdVariationField = {
  id: 'headline' | 'primaryText' | 'cta' | 'formatNote' | 'audienceAngle' | 'complianceRisk'
  label: string
  value: string
  multiline?: boolean
}

export type ParsedAdVariation = {
  number: string
  heading: string
  text: string
  fields: AdVariationField[]
}

export type ParsedAdVariations = {
  title: string
  intro: string
  metadata: Record<string, string>
  variations: ParsedAdVariation[]
  footer: string
}

const FIELD_SPECS: Array<{
  id: AdVariationField['id']
  labels: string[]
  displayLabel: string
  multiline?: boolean
}> = [
  { id: 'headline', labels: ['Headline'], displayLabel: 'Headline' },
  { id: 'primaryText', labels: ['Primary Text', 'Primary text', 'Body'], displayLabel: 'Primary text', multiline: true },
  { id: 'cta', labels: ['CTA Button', 'CTA'], displayLabel: 'CTA button' },
  { id: 'formatNote', labels: ['Format Note', 'Format note'], displayLabel: 'Format note', multiline: true },
  { id: 'audienceAngle', labels: ['Audience Angle', 'Audience angle'], displayLabel: 'Audience angle', multiline: true },
  { id: 'complianceRisk', labels: ['Compliance Risk', 'Compliance risk'], displayLabel: 'Compliance risk', multiline: true },
]

const METADATA_LABELS = ['Platform', 'Objective', 'Audience', 'Offer'] as const

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractInlineValue(text: string, label: string): string | null {
  const pattern = new RegExp(`\\*\\*${escapeRegExp(label)}:\\*\\*\\s*(.+?)(?=\\n\\*\\*|\\n##|$)`, 'is')
  const match = text.match(pattern)
  if (!match) return null
  const value = match[1].replace(/\s+$/g, '').trim()
  return value || null
}

function extractMultilineValue(text: string, label: string, stopLabels: string[]): string | null {
  const startPattern = new RegExp(`\\*\\*${escapeRegExp(label)}:\\*\\*\\s*\\n?`, 'i')
  const startMatch = text.match(startPattern)
  if (startMatch == null || startMatch.index == null) return null

  const valueStart = startMatch.index + startMatch[0].length
  let end = text.length

  for (const stopLabel of stopLabels) {
    const stopPattern = new RegExp(`\\n\\*\\*${escapeRegExp(stopLabel)}:\\*\\*`, 'i')
    const stopMatch = text.slice(valueStart).match(stopPattern)
    if (stopMatch?.index != null) {
      end = Math.min(end, valueStart + stopMatch.index)
    }
  }

  const value = text.slice(valueStart, end).trim()
  return value || null
}

function allFieldLabels(): string[] {
  return FIELD_SPECS.flatMap(spec => spec.labels)
}

export function parseAdVariationFields(text: string): AdVariationField[] {
  const fields: AdVariationField[] = []
  const labels = allFieldLabels()

  for (const spec of FIELD_SPECS) {
    let value: string | null = null

    for (const label of spec.labels) {
      const stopLabels = labels.filter(item => item !== label)
      value = spec.multiline
        ? extractMultilineValue(text, label, stopLabels)
        : extractInlineValue(text, label)
      if (value) break
    }

    if (value) {
      fields.push({
        id: spec.id,
        label: spec.displayLabel,
        value,
        multiline: spec.multiline,
      })
    }
  }

  return fields
}

function parseMetadata(intro: string): Record<string, string> {
  const metadata: Record<string, string> = {}
  for (const label of METADATA_LABELS) {
    const value = extractInlineValue(intro, label)
    if (value) metadata[label] = value
  }
  return metadata
}

function parseTitle(intro: string): string {
  const match = intro.match(/^#\s+(.+?)(?:\n|$)/)
  return match?.[1]?.trim() ?? ''
}

export function parseAdVariationsMarkdown(content: string): ParsedAdVariations | null {
  const normalized = content.replace(/\r\n/g, '\n').trim()
  if (!/##\s*VARIATION\s+\d+/i.test(normalized)) return null

  const complianceMatch = normalized.match(/\n##\s*Compliance Notes/i)
  const main = complianceMatch?.index != null
    ? normalized.slice(0, complianceMatch.index).trim()
    : normalized
  const footer = complianceMatch?.index != null
    ? normalized.slice(complianceMatch.index).trim()
    : ''

  const firstVariationIdx = main.search(/##\s*VARIATION\s+\d+/i)
  const intro = firstVariationIdx > 0 ? main.slice(0, firstVariationIdx).trim() : ''
  const variationBody = firstVariationIdx >= 0 ? main.slice(firstVariationIdx).trim() : main

  const chunks = variationBody.split(/(?=##\s*VARIATION\s+\d+)/i).filter(Boolean)
  const variations: ParsedAdVariation[] = []

  for (const chunk of chunks) {
    const match = chunk.match(/^##\s*VARIATION\s+(\d+):\s*([^\n]+)\n([\s\S]*)$/i)
    if (!match) continue
    const text = chunk.trim()
    variations.push({
      number: match[1],
      heading: match[2].trim(),
      text,
      fields: parseAdVariationFields(text),
    })
  }

  if (variations.length === 0) return null

  return {
    title: parseTitle(intro),
    intro,
    metadata: parseMetadata(intro),
    variations,
    footer,
  }
}

/** Short preview for collapsed approval cards. */
export function adVariationsPreview(content: string): string | null {
  const parsed = parseAdVariationsMarkdown(content)
  if (!parsed) return null

  const first = parsed.variations[0]
  const headline = first.fields.find(field => field.id === 'headline')?.value
  if (headline) {
    return `Variation 1 — ${headline}`
  }

  if (parsed.title) return parsed.title
  if (first.heading) return `Variation 1 — ${first.heading}`
  return null
}

/** Plain-text bundle for pasting one ad into Ads Manager. */
export function adVariationPasteBlock(variation: ParsedAdVariation): string {
  const lines: string[] = []
  for (const field of variation.fields) {
    if (field.multiline) {
      lines.push('', `${field.label}:`, field.value, '')
    } else {
      lines.push(`${field.label}: ${field.value}`)
    }
  }

  if (lines.length === 0) return variation.text
  return lines.join('\n').trim()
}
