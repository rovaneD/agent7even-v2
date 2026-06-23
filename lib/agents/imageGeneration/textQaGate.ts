import { generateText } from 'ai'
import { openrouter } from '@/lib/ai/client'
import { buildVisionUserMessageFromStorage, VISION_CAPTION_MODEL } from '@/lib/agents/visionCaption'
import { loadBrandKitGenerationSnapshot } from './brandKitSnapshot'
import { detectDesignSpecInImageText } from './designSpecLeakDetection'
import { detectFontMetadataInImageText } from './fontLeakDetection'
import { detectLogoLockupInImageText, detectInventedLogoBadgeInImageText } from './logoLockupDetection'
import { detectGenericHeadlineInImageText, type PostGroundingContext } from './postGrounding'
import { loadBrandTokensForQa } from './brandTokens'
import { FAKE_SCREEN_UI_QA_RULE } from './fakeScreenUiDetection'
import { detectUnwantedOnImageCtaButtons } from './onImageCtaDetection'
import { detectMissingOnImageHeadline } from './headlineRequiredBrief'
import { isBoilerplateCtaPhrase, resolveExpectedHeadline } from './headlineExtract'
import { verifyHeadlineSpellingInImage } from './headlineSpellingVerify'
import { detectExpectedHeadlineMismatch, detectExpectedWordMisspellings, detectObviousTyposInImageText } from './typoDetection'
import type { TextQaIssue, TextQaResult } from './types'

const QA_INSTRUCTION = `You are a quality gate for AI-generated marketing images with text baked into the visual.

Transcribe ALL visible text in the image exactly as rendered (headlines, labels, watermarks, UI chrome).

TRANSCRIPTION RULES (CRITICAL — you are OCR, not autocorrect):
- Write the exact letters painted in the image, including all misspellings
- If the image says "Awarenss" you MUST transcribe "Awarenss" — NEVER "Awareness"
- If letters are missing, doubled, swapped, or garbled, transcribe what you actually see
- Do not fix, improve, or guess intended words
{{SPELLING_VERIFY}}
Return ONLY valid JSON — no markdown fences:

{
  "transcribedText": "full transcription or empty string if no text",
  "lines": ["each distinct text line"],
  "issues": [
    { "code": "typo|garbled|wrong_brand|unintended_text|invented_logo|environmental_logo|off_palette_grade|fake_screen_ui|unwanted_cta|missing_headline|vague_headline", "message": "specific issue" }
  ],
  "passed": true
}

Rules for passed=false:
- Obvious typos or garbled nonsense in prominent text — including doubled-letter slips (e.g. "rrun" instead of "run") — not minor anti-aliasing
- IF a brand name IS visible in the image: it must be spelled correctly (fail wrong_brand only when the name appears but is misspelled)
- IF a competitor or wrong company name appears in prominent text (fail wrong_brand)
- Random letter soup, broken words, or lorem-style filler in headline areas
- Font family names, font weights, or CSS typography specs visible as text (e.g. "Inter 600", "Lora Bold", "font-weight: 600") — these are design metadata, not marketing copy
- Hex color codes (#RGB or #RRGGBB) or color swatch legends visible as text
- Image is primarily a logo lockup, wordmark tile, monogram, or abstract brand mark with the company name — social posts need a marketing headline about the post topic, not identity design
- ANY invented graphic logo or brand mark visible anywhere in the scene when logo was not requested — including on laptop lids, device backs, phone screens, neon wall signs, backlit signage, or background decor (flag code environmental_logo or invented_logo)
- Heavy sepia, brown, terracotta, or warm amber color grading on the overall scene when the brand uses blue/slate accents — electric blue headline on a brown-filtered photo still fails (flag code off_palette_grade)
- Headline is generic stock filler unrelated to the post ask (e.g. "Boost your brand", "Real talk over coffee") when a specific post goal is provided below
- On-image CTA buttons or pills (e.g. "See how it works", "Learn how", "Start free trial", "Get started") — social post images are headline-only; fail with code unwanted_cta unless Must include explicitly requests a button
- Textless editorial stock photo with no readable headline — social post graphics MUST have headline text (fail code missing_headline)
${FAKE_SCREEN_UI_QA_RULE}
{{LOGO_RULE}}
{{POST_CONTEXT}}

Brand name policy (IMPORTANT):
- Do NOT fail because the company/brand name is absent — most social posts use pain-point headlines, offers, or carousel slide copy WITHOUT naming the product
- Pain headlines like "Stop wasting money on useless reports" are valid with no brand name
- Only fail wrong_brand when a brand name IS shown but misspelled, or when a wrong/competitor name appears
- Only require the brand name if Must include below explicitly asks for it

Visual inspection (beyond transcription):
- Scan the full frame for logos on objects and environmental signage — fail even if transcription omits them.
- Scan overall color grade — fail brown/sepia washes unless post ask explicitly requests that mood.

Rules for passed=true:
- No readable text in the image, OR
- All prominent text is legible, connects to the post ask, and any visible brand names are spelled correctly

Known brand name(s) — spell-check ONLY if they appear in the image (not required to appear): {{BRANDS}}`

function buildQaInstruction(opts: {
  brandTokens: string[]
  companyName: string
  postContext?: PostGroundingContext
  includeLogo?: boolean
  expectedHeadline?: string | null
}): string {
  const logoRule = opts.includeLogo
    ? '- User opted IN to include a logo — a small logo placement zone is OK; still fail invented wrong logos that do not match uploaded assets.'
    : '- User did NOT request a logo on this post — fail if the image includes ANY invented logo icon, wordmark beside a symbol, geometric identity grid, abstract brand mark, company name paired with a graphic mark, logo on a laptop lid or device, neon/wall brand signage, or circular badge in the scene (flag code invented_logo or environmental_logo). Colors and typography only.'

  const postLines: string[] = []
  if (opts.postContext?.postGoal) postLines.push(`Post goal: ${opts.postContext.postGoal}`)
  if (opts.postContext?.offer) postLines.push(`Offer / CTA: ${opts.postContext.offer}`)
  if (opts.postContext?.audience) postLines.push(`Audience: ${opts.postContext.audience}`)
  if (opts.postContext?.mustInclude) postLines.push(`Must include: ${opts.postContext.mustInclude}`)
  const postBlock = postLines.length > 0
    ? `\nPost ask (headline must connect to this — no on-image CTA buttons):\n${postLines.join('\n')}`
    : ''

  const spellingBlock = opts.expectedHeadline?.trim()
    ? `\nExpected headline from brief (verify each word is spelled exactly in the image — fail typos like missing letters):\n"${opts.expectedHeadline.trim()}"\n`
    : ''

  return QA_INSTRUCTION
    .replace('{{BRANDS}}', opts.brandTokens.join(' · ') || opts.companyName)
    .replace('{{LOGO_RULE}}', logoRule)
    .replace('{{POST_CONTEXT}}', postBlock)
    .replace('{{SPELLING_VERIFY}}', spellingBlock)
}

/** Vision model sometimes fails posts for missing brand name — that is valid marketing copy. */
function filterSpuriousHeadlineCompareIssues(
  issues: Array<{ code: string; message: string }>,
  expectedHeadline: string | null | undefined,
): Array<{ code: string; message: string }> {
  if (expectedHeadline?.trim()) return issues
  return issues.filter(issue => {
    const msg = issue.message.toLowerCase()
    return !(
      msg.includes('expected headline')
      || (issue.code === 'typo' && msg.includes('expected "see"'))
      || (issue.code === 'typo' && msg.includes('but reads "awareness'))
    )
  })
}

/** Vision model sometimes fails posts for missing brand name — that is valid marketing copy. */
function filterSpuriousBrandNameIssues(
  issues: Array<{ code: string; message: string }>,
  postContext?: PostGroundingContext,
): Array<{ code: string; message: string }> {
  const mustInclude = postContext?.mustInclude?.trim() ?? ''
  const requiresBrandInCopy =
    mustInclude.length > 0
    && /\b(?:brand|company|product|agent7even|business name)\b/i.test(mustInclude)

  if (requiresBrandInCopy) return issues

  return issues.filter(issue => {
    if (issue.code !== 'wrong_brand' && issue.code !== 'unintended_text') return true
    const msg = issue.message.toLowerCase()
    return !(
      /no mention of/.test(msg)
      || /does not mention/.test(msg)
      || /missing.*brand/.test(msg)
      || /absent.*brand/.test(msg)
      || /without.*brand name/.test(msg)
      || /brand name.*not (?:present|included|mentioned|visible)/.test(msg)
      || /must include.*brand/.test(msg)
      || /should mention.*brand/.test(msg)
    )
  })
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
  expectedHeadline?: string | null
  brief?: string | null
}): Promise<TextQaResult> {
  const expectedHeadline = resolveExpectedHeadline(opts.brief, opts.expectedHeadline)
  const spellingHeadline =
    expectedHeadline && !isBoilerplateCtaPhrase(expectedHeadline) ? expectedHeadline : null
  const brandTokens = await loadBrandTokensForQa(opts.profileId, opts.companyName)
  const instruction = buildQaInstruction({
    brandTokens,
    companyName: opts.companyName,
    postContext: opts.postContext,
    includeLogo: opts.includeLogo,
    expectedHeadline: spellingHeadline,
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
  let visionIssues = filterSpuriousBrandNameIssues(parsed.issues, opts.postContext)
  visionIssues = filterSpuriousHeadlineCompareIssues(visionIssues, spellingHeadline)
  const brandKit = await loadBrandKitGenerationSnapshot(opts.profileId)
  const fontFamilies = brandKit.fonts.map(f => f.family)
  const colorNames = brandKit.colors.map(c => c.name).filter(Boolean) as string[]
  const fontLeakIssues = detectFontMetadataInImageText(parsed.transcribedText, fontFamilies)
  const designLeakIssues = detectDesignSpecInImageText(parsed.transcribedText, colorNames)
  const logoLockupIssues = detectLogoLockupInImageText(parsed.transcribedText, brandTokens)
  const inventedBadgeIssues = detectInventedLogoBadgeInImageText(
    parsed.transcribedText,
    brandTokens,
    opts.includeLogo,
  )
  const groundingIssues = detectGenericHeadlineInImageText(parsed.transcribedText, opts.postContext)
  const unwantedCtaIssues = detectUnwantedOnImageCtaButtons(parsed.transcribedText, opts.postContext)
  const missingHeadlineIssues = detectMissingOnImageHeadline(parsed.transcribedText, brandTokens)
  const typoIssues = detectObviousTyposInImageText(parsed.transcribedText)
  const headlineMismatchIssues = detectExpectedHeadlineMismatch(
    parsed.transcribedText,
    spellingHeadline,
  )
  const expectedWordMisspellings = detectExpectedWordMisspellings(
    parsed.transcribedText,
    spellingHeadline,
  )
  const spellingVerify = spellingHeadline
    ? await verifyHeadlineSpellingInImage({
      storagePath: opts.storagePath,
      expectedHeadline: spellingHeadline,
    })
    : { issues: [] as TextQaIssue[], wordChecks: [] }
  const spellingRenderedText = spellingVerify.wordChecks.map(w => w.renderedAs).filter(Boolean).join(' ')
  const spellingRenderedTypos = detectObviousTyposInImageText(spellingRenderedText)
  const mergedIssues = [
    ...visionIssues,
    ...fontLeakIssues,
    ...designLeakIssues,
    ...logoLockupIssues,
    ...inventedBadgeIssues,
    ...groundingIssues,
    ...unwantedCtaIssues,
    ...missingHeadlineIssues,
    ...typoIssues,
    ...headlineMismatchIssues,
    ...expectedWordMisspellings,
    ...spellingVerify.issues,
    ...spellingRenderedTypos,
  ]
  const passed = mergedIssues.length === 0

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
