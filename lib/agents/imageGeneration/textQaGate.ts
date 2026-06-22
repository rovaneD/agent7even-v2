import { generateText } from 'ai'
import { openrouter } from '@/lib/ai/client'
import { buildVisionUserMessageFromStorage, VISION_CAPTION_MODEL } from '@/lib/agents/visionCaption'
import { loadBrandKitGenerationSnapshot } from './brandKitSnapshot'
import { detectDesignSpecInImageText } from './designSpecLeakDetection'
import { detectFontMetadataInImageText } from './fontLeakDetection'
import { detectLogoLockupInImageText } from './logoLockupDetection'
import { detectGenericHeadlineInImageText, type PostGroundingContext } from './postGrounding'
import { loadBrandTokensForQa } from './brandTokens'
import type { TextQaResult } from './types'

const QA_INSTRUCTION = `You are a quality gate for AI-generated marketing images with text baked into the visual.

Transcribe ALL visible text in the image exactly as rendered (headlines, labels, watermarks, UI chrome).
Return ONLY valid JSON — no markdown fences:

{
  "transcribedText": "full transcription or empty string if no text",
  "lines": ["each distinct text line"],
  "issues": [
    { "code": "typo|garbled|wrong_brand|unintended_text|invented_logo|vague_headline|missing_cta", "message": "specific issue" }
  ],
  "passed": true
}

Rules for passed=false:
- Obvious typos or garbled nonsense in prominent text (not minor anti-aliasing)
- Misspelling of the known brand name(s) provided below
- Random letter soup, broken words, or lorem-style filler in headline areas
- Text that contradicts the brand (wrong company name)
- Font family names, font weights, or CSS typography specs visible as text (e.g. "Inter 600", "Lora Bold", "font-weight: 600") — these are design metadata, not marketing copy
- Hex color codes (#RGB or #RRGGBB) or color swatch legends visible as text
- Image is primarily a logo lockup, wordmark tile, monogram, or abstract brand mark with the company name — social posts need a marketing headline about the post topic, not identity design
- Headline is generic stock filler unrelated to the post ask (e.g. "Boost your brand", "Real talk over coffee") when a specific post goal is provided below
- Post form includes an offer/CTA but the image has no visible call-to-action tied to it
{{LOGO_RULE}}
{{POST_CONTEXT}}

Rules for passed=true:
- No readable text in the image, OR
- All prominent text is legible, connects to the post ask, and brand names are spelled correctly

Known brand name(s) to verify: {{BRANDS}}`

function buildQaInstruction(opts: {
  brandTokens: string[]
  companyName: string
  postContext?: PostGroundingContext
  includeLogo?: boolean
}): string {
  const logoRule = opts.includeLogo
    ? '- User opted IN to include a logo — a small logo placement zone is OK; still fail invented wrong logos that do not match uploaded assets.'
    : '- User did NOT request a logo on this post — fail if the image includes ANY invented logo icon, wordmark beside a symbol, geometric identity grid, abstract brand mark, or company name paired with a graphic mark (flag code invented_logo). Colors and typography only.'

  const postLines: string[] = []
  if (opts.postContext?.postGoal) postLines.push(`Post goal: ${opts.postContext.postGoal}`)
  if (opts.postContext?.offer) postLines.push(`Offer / CTA: ${opts.postContext.offer}`)
  if (opts.postContext?.audience) postLines.push(`Audience: ${opts.postContext.audience}`)
  if (opts.postContext?.mustInclude) postLines.push(`Must include: ${opts.postContext.mustInclude}`)
  const postBlock = postLines.length > 0
    ? `\nPost ask (headline and CTA must connect to this):\n${postLines.join('\n')}`
    : ''

  return QA_INSTRUCTION
    .replace('{{BRANDS}}', opts.brandTokens.join(' · ') || opts.companyName)
    .replace('{{LOGO_RULE}}', logoRule)
    .replace('{{POST_CONTEXT}}', postBlock)
}

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
  postContext?: PostGroundingContext
  includeLogo?: boolean
}): Promise<TextQaResult> {
  const brandTokens = await loadBrandTokensForQa(opts.profileId, opts.companyName)
  const instruction = buildQaInstruction({
    brandTokens,
    companyName: opts.companyName,
    postContext: opts.postContext,
    includeLogo: opts.includeLogo,
  })

  let visionContent
  try {
    visionContent = await buildVisionUserMessageFromStorage({
      textInstruction: instruction,
      storagePath: opts.storagePath,
    })
  } catch {
    return {
      passed: false,
      transcription: null,
      issues: [{ code: 'preview_failed', message: 'Could not read the image for text QA.' }],
      qaMethod: 'vision_readback',
    }
  }

  const result = await generateText({
    model: openrouter(VISION_CAPTION_MODEL),
    messages: [{ role: 'user', content: visionContent }],
    maxOutputTokens: 900,
    temperature: 0.1,
  })

  const parsed = parseQaJson(result.text.trim())
  const brandKit = await loadBrandKitGenerationSnapshot(opts.profileId)
  const fontFamilies = brandKit.fonts.map(f => f.family)
  const colorNames = brandKit.colors.map(c => c.name).filter(Boolean) as string[]
  const fontLeakIssues = detectFontMetadataInImageText(parsed.transcribedText, fontFamilies)
  const designLeakIssues = detectDesignSpecInImageText(parsed.transcribedText, colorNames)
  const logoLockupIssues = detectLogoLockupInImageText(parsed.transcribedText, brandTokens)
  const groundingIssues = detectGenericHeadlineInImageText(parsed.transcribedText, opts.postContext)
  const mergedIssues = [
    ...parsed.issues,
    ...fontLeakIssues,
    ...designLeakIssues,
    ...logoLockupIssues,
    ...groundingIssues,
  ]
  const passed = parsed.passed && mergedIssues.length === 0

  return {
    passed,
    transcription: parsed.transcribedText || null,
    lines: parsed.lines,
    issues: passed ? [] : mergedIssues.length > 0
      ? mergedIssues
      : [{ code: 'qa_failed', message: 'Text QA flagged this image — review spelling and brand name in the visual.' }],
    qaMethod: 'vision_readback',
  }
}
