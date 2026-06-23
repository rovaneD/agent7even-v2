/** CTA examples in rule text — not real on-image headlines. */
const BOILERPLATE_CTA_PHRASES = new Set([
  'see how it works',
  'learn how',
  'start free trial',
  'start your free trial',
  'get started',
  'get real results',
  'meet maya',
  'sign up',
  'try free',
  'learn more',
  'book a demo',
  'book a call',
  "let's talk",
])

export function isBoilerplateCtaPhrase(text: string | null | undefined): boolean {
  const norm = text?.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!norm) return false
  return BOILERPLATE_CTA_PHRASES.has(norm)
}

/** Pull the intended on-image headline from a generation brief (quoted copy). */
export function extractHeadlineFromBrief(brief: string | null | undefined): string | null {
  const text = brief?.trim()
  if (!text) return null

  const labeledPatterns = [
    /\bheadline on image\s+["']([^"']+)["']/i,
    /\bheadline text on image\s+["']([^"']+)["']/i,
    /\bheadline:\s*["']([^"']+)["']/i,
  ]
  for (const pattern of labeledPatterns) {
    const match = text.match(pattern)
    const headline = match?.[1]?.trim()
    if (headline && !isBoilerplateCtaPhrase(headline)) return headline
  }

  const headlineKeywordIdx = text.toLowerCase().indexOf('headline')
  const quoted = [...text.matchAll(/["']([^"']{4,})["']/g)]
    .map(m => ({ quote: m[1]!.trim(), index: m.index ?? 0 }))
    .filter(({ quote }) => /[a-zA-Z]/.test(quote) && !isBoilerplateCtaPhrase(quote))

  if (quoted.length === 0) return null

  if (headlineKeywordIdx >= 0) {
    const nearHeadline = quoted
      .filter(q => q.index >= headlineKeywordIdx - 30 && q.index <= headlineKeywordIdx + 160)
      .sort((a, b) => a.index - b.index)
    if (nearHeadline.length > 0) return nearHeadline[0]!.quote
  }

  return quoted.sort((a, b) => b.quote.length - a.quote.length)[0]?.quote ?? null
}

export function resolveExpectedHeadline(
  brief: string | null | undefined,
  explicit?: string | null,
): string | null {
  const fromExplicit = explicit?.trim()
  if (fromExplicit && !isBoilerplateCtaPhrase(fromExplicit)) return fromExplicit

  const fromBrief = extractHeadlineFromBrief(brief)
  if (fromBrief && !isBoilerplateCtaPhrase(fromBrief)) return fromBrief

  return null
}
