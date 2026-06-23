import { generateText } from 'ai'
import { openrouter } from '@/lib/ai/client'
import { buildVisionUserMessageFromStorage, VISION_CAPTION_MODEL } from '@/lib/agents/visionCaption'
import type { TextQaIssue } from './types'

function buildSpellingVerifyInstruction(expectedHeadline: string): string {
  return `You are a literal OCR inspector for AI-generated marketing images — NOT a spellchecker.

Expected headline (reference — do NOT assume the image matches):
"${expectedHeadline}"

Task: Read the MAIN HEADLINE text painted in the image letter-by-letter.
For each word in the expected headline above, report what is ACTUALLY rendered.

Return ONLY valid JSON — no markdown fences:
{
  "wordChecks": [
    { "expected": "Qualified", "renderedAs": "Qualfied", "correct": false },
    { "expected": "Awareness", "renderedAs": "Awareness", "correct": true }
  ],
  "passed": false
}

Rules:
- renderedAs = literal letters you see painted — NEVER autocorrect to the expected word
- Watch for dropped INTERNAL letters (e.g. "Qualfied" missing i, "Awarenss" missing e) — these are common AI typos
- If a letter is missing, extra, swapped, or garbled → correct: false
- correct: true ONLY when renderedAs matches expected exactly (case-insensitive OK)
- passed: true ONLY when every word in the expected headline has correct: true
- Ignore CTA buttons, subheads, and corner brand names unless they are part of the expected headline string`
}

function parseSpellingVerifyJson(raw: string): {
  wordChecks: Array<{ expected: string; renderedAs: string; correct: boolean }>
  passed: boolean
} {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Spelling verify did not return JSON')
  const parsed = JSON.parse(jsonMatch[0]) as {
    wordChecks?: Array<{ expected?: string; renderedAs?: string; correct?: boolean }>
    passed?: boolean
  }

  const wordChecks = (parsed.wordChecks ?? [])
    .filter(w => w.expected?.trim())
    .map(w => {
      const expected = w.expected!.trim()
      const renderedAs = (w.renderedAs ?? '').trim()
      const exactMatch = renderedAs.toLowerCase() === expected.toLowerCase()
      return {
        expected,
        renderedAs,
        correct: exactMatch,
      }
    })

  const passed = wordChecks.length > 0 && wordChecks.every(w => w.correct)
  return { wordChecks, passed }
}

/** Second vision pass — catches misspellings the main QA autocorrects away (e.g. Awarenss → Awareness). */
export async function verifyHeadlineSpellingInImage(opts: {
  storagePath: string
  expectedHeadline: string
}): Promise<{ issues: TextQaIssue[]; wordChecks: Array<{ expected: string; renderedAs: string; correct: boolean }> }> {
  const expected = opts.expectedHeadline.trim()
  if (!expected) return { issues: [], wordChecks: [] }

  let visionContent
  try {
    visionContent = await buildVisionUserMessageFromStorage({
      textInstruction: buildSpellingVerifyInstruction(expected),
      storagePath: opts.storagePath,
    })
  } catch {
    return {
      issues: [{ code: 'preview_failed', message: 'Could not verify headline spelling in the image.' }],
      wordChecks: [],
    }
  }

  try {
    const result = await generateText({
      model: openrouter(VISION_CAPTION_MODEL),
      messages: [{ role: 'user', content: visionContent }],
      maxOutputTokens: 600,
      temperature: 0,
    })

    const parsed = parseSpellingVerifyJson(result.text.trim())
    if (parsed.passed) return { issues: [], wordChecks: parsed.wordChecks }

    const issues: TextQaIssue[] = parsed.wordChecks
      .filter(w => !w.correct)
      .map(w => ({
        code: 'typo',
        message: w.renderedAs
          ? `Headline word misspelled — expected "${w.expected}" but image reads "${w.renderedAs}".`
          : `Headline word "${w.expected}" is missing or illegible in the image.`,
      }))

    return {
      issues: issues.length > 0
        ? issues
        : [{ code: 'typo', message: 'Headline spelling does not match the brief — review letter-by-letter.' }],
      wordChecks: parsed.wordChecks,
    }
  } catch {
    return { issues: [], wordChecks: [] }
  }
}
