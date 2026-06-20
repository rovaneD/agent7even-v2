import { generateText } from 'ai'
import { openrouter } from '@/lib/ai/client'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { buildVisionUserMessage, VISION_CAPTION_MODEL } from '@/lib/agents/visionCaption'
import { loadBrandTokensForQa } from './brandTokens'
import type { TextQaResult } from './types'

const QA_INSTRUCTION = `You are a quality gate for AI-generated marketing images with text baked into the visual.

Transcribe ALL visible text in the image exactly as rendered (headlines, labels, watermarks, UI chrome).
Return ONLY valid JSON — no markdown fences:

{
  "transcribedText": "full transcription or empty string if no text",
  "lines": ["each distinct text line"],
  "issues": [
    { "code": "typo|garbled|wrong_brand|unintended_text", "message": "specific issue" }
  ],
  "passed": true
}

Rules for passed=false:
- Obvious typos or garbled nonsense in prominent text (not minor anti-aliasing)
- Misspelling of the known brand name(s) provided below
- Random letter soup, broken words, or lorem-style filler in headline areas
- Text that contradicts the brand (wrong company name)

Rules for passed=true:
- No readable text in the image, OR
- All prominent text is legible and brand names are spelled correctly

Known brand name(s) to verify: {{BRANDS}}`

function parseQaJson(raw: string): {
  transcribedText: string
  lines: string[]
  issues: Array<{ code: string; message: string }>
  passed: boolean
} {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('QA model did not return JSON')
  const parsed = JSON.parse(jsonMatch[0]) as {
    transcribedText?: string
    lines?: string[]
    issues?: Array<{ code?: string; message?: string }>
    passed?: boolean
  }

  const issues = (parsed.issues ?? [])
    .filter(i => i.message?.trim())
    .map(i => ({
      code: (i.code ?? 'unintended_text').trim(),
      message: i.message!.trim(),
    }))

  return {
    transcribedText: (parsed.transcribedText ?? '').trim(),
    lines: (parsed.lines ?? []).map(l => String(l).trim()).filter(Boolean),
    issues,
    passed: parsed.passed === true && issues.length === 0,
  }
}

/** Vision read-back text QA on a generated post image (handoff §2c). */
export async function runTextQaGate(opts: {
  profileId: string
  companyName: string
  storagePath: string
}): Promise<TextQaResult> {
  const signedUrl = await createPostAssetSignedUrl(opts.storagePath, 3600)
  if (!signedUrl) {
    return {
      passed: false,
      transcription: null,
      issues: [{ code: 'preview_failed', message: 'Could not read the image for text QA.' }],
      qaMethod: 'vision_readback',
    }
  }

  const brandTokens = await loadBrandTokensForQa(opts.profileId, opts.companyName)
  const instruction = QA_INSTRUCTION.replace('{{BRANDS}}', brandTokens.join(' · ') || opts.companyName)

  const visionContent = buildVisionUserMessage({
    textInstruction: instruction,
    imageUrl: signedUrl,
  })

  const result = await generateText({
    model: openrouter(VISION_CAPTION_MODEL),
    messages: [{ role: 'user', content: visionContent }],
    maxOutputTokens: 900,
    temperature: 0.1,
  })

  const parsed = parseQaJson(result.text.trim())
  const passed = parsed.passed && parsed.issues.length === 0

  return {
    passed,
    transcription: parsed.transcribedText || null,
    lines: parsed.lines,
    issues: passed ? [] : parsed.issues.length > 0
      ? parsed.issues
      : [{ code: 'qa_failed', message: 'Text QA flagged this image — review spelling and brand name in the visual.' }],
    qaMethod: 'vision_readback',
  }
}
