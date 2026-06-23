import type { TextQaIssue } from './types'

/** Common marketing words — used to flag obvious doubled-letter typos (e.g. "rrun" → "run"). */
const COMMON_WORDS = new Set([
  'run', 'your', 'business', 'marketing', 'results', 'report', 'reports',
  'start', 'trial', 'free', 'get', 'real', 'finally', 'think', 'while',
  'without', 'need', 'stop', 'paying', 'clients', 'growth', 'brand',
  'meet', 'agent', 'figures', 'what', 'does', 'works', 'work', 'entire',
  'wasting', 'money', 'useless', 'useful', 'awareness', 'qualified', 'demand',
  'signal', 'signals', 'invisible', 'touchpoints', 'measurable', 'impact', 'turn',
  'into', 'every', 'matters', 'place', 'works', 'drives', 'action', 'actually',
])

/** Garbled renderings vision models often produce instead of common words. */
const GARBLED_WORD_PATTERNS: Array<{ pattern: RegExp; expected: string }> = [
  { pattern: /\brour\b/i, expected: 'your or run' },
  { pattern: /\bpour\b(?=\s+business)/i, expected: 'your' },
  { pattern: /\byrou\b/i, expected: 'your' },
  { pattern: /\byor\b(?=\s+business)/i, expected: 'your' },
  { pattern: /\brrun\b/i, expected: 'run' },
  { pattern: /\broun\b(?=\s+(?:your|the)\b)/i, expected: 'run' },
  { pattern: /\bbuisness\b/i, expected: 'business' },
  { pattern: /\bbussiness\b/i, expected: 'business' },
  { pattern: /\bmarkting\b/i, expected: 'marketing' },
  { pattern: /\bmarkeing\b/i, expected: 'marketing' },
  { pattern: /\bawarenss\b/i, expected: 'awareness' },
  { pattern: /\bqualifed\b/i, expected: 'qualified' },
  { pattern: /\bdemad\b/i, expected: 'demand' },
]

function normalizeWord(word: string): string {
  return word.replace(/'/g, '').toLowerCase()
}

function normalizeText(text: string): string {
  return text.replace(/[^\w\s']/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!)
    }
  }
  return dp[m]![n]!
}

/** Catch single dropped-letter typos (e.g. Qualfied → Qualified) when OCR reports the misspelling. */
function detectDroppedLetterTypos(
  transcription: string | null | undefined,
): TextQaIssue[] {
  const text = transcription?.trim()
  if (!text) return []

  const issues: TextQaIssue[] = []
  const words = text.match(/\b[A-Za-z']{5,}\b/g) ?? []

  for (const word of words) {
    const lower = normalizeWord(word)
    if (COMMON_WORDS.has(lower)) continue

    for (let i = 0; i <= lower.length; i++) {
      for (const letter of 'aeioulnrst') {
        const candidate = lower.slice(0, i) + letter + lower.slice(i)
        if (COMMON_WORDS.has(candidate) && candidate !== lower) {
          issues.push({
            code: 'typo',
            message: `Headline contains misspelled word "${word}" — should read "${candidate}".`,
          })
          break
        }
      }
      if (issues.length > 0 && issues[issues.length - 1]!.message.includes(`"${word}"`)) break
    }
  }

  return issues
}

/** Compare expected headline words to transcription — fail near-miss spellings (Qualfied vs Qualified). */
export function detectExpectedWordMisspellings(
  transcription: string | null | undefined,
  expectedHeadline: string | null | undefined,
): TextQaIssue[] {
  const expected = expectedHeadline?.trim()
  if (!expected || !transcription?.trim()) return []

  const transWords = (transcription.match(/\b[A-Za-z']{4,}\b/g) ?? []).map(w => normalizeWord(w))
  const expectedWords = expected.split(/\s+/).map(w => normalizeWord(w)).filter(w => w.length >= 4)

  const issues: TextQaIssue[] = []
  for (const expectedWord of expectedWords) {
    if (transWords.some(w => w === expectedWord)) continue

    const nearMiss = transWords.find(w => levenshtein(w, expectedWord) === 1)
    if (nearMiss) {
      issues.push({
        code: 'typo',
        message: `Headline word misspelled — expected "${expectedWord}" but reads "${nearMiss}".`,
      })
    }
  }

  return issues
}

/** Deterministic typo check — catches doubled-letter slips and common garbled words. */
export function detectObviousTyposInImageText(
  transcription: string | null | undefined,
): TextQaIssue[] {
  const text = transcription?.trim()
  if (!text) return []

  const issues: TextQaIssue[] = []
  const words = text.match(/\b[A-Za-z']{3,}\b/g) ?? []

  for (const { pattern, expected } of GARBLED_WORD_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      issues.push({
        code: 'typo',
        message: `Headline contains garbled text "${match[0]}" — should read "${expected}".`,
      })
    }
  }

  for (const word of words) {
    const lower = normalizeWord(word)
    if (COMMON_WORDS.has(lower)) continue

    for (let i = 0; i < lower.length - 1; i++) {
      if (lower[i] !== lower[i + 1]) continue
      const fixed = lower.slice(0, i) + lower.slice(i + 1)
      if (fixed.length >= 3 && COMMON_WORDS.has(fixed) && fixed !== lower) {
        issues.push({
          code: 'typo',
          message: `Headline contains a doubled-letter typo ("${word}" — should read "${fixed}").`,
        })
        break
      }
    }
  }

  issues.push(...detectDroppedLetterTypos(text))

  return issues
}

/** After a text-only edit, verify the requested headline actually appears (not garbled). */
export function detectExpectedHeadlineMismatch(
  transcription: string | null | undefined,
  expectedHeadline: string | null | undefined,
): TextQaIssue[] {
  const expected = expectedHeadline?.trim()
  if (!expected || !transcription?.trim()) return []

  const normTrans = normalizeText(transcription)
  const normExpected = normalizeText(expected)
  if (normTrans.includes(normExpected)) return []

  const expectedWords = normExpected.split(' ').filter(w => w.length >= 4)
  if (expectedWords.length === 0) return []

  const missing = expectedWords.filter(w => !normTrans.includes(w))
  if (missing.length === 0) return []

  return [{
    code: 'typo',
    message: `Headline does not match the requested copy — missing or garbled: ${missing.slice(0, 4).join(', ')}.`,
  }]
}
