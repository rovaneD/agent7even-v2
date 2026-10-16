import { openRouterComplete } from '@/lib/agents/openrouter'
import { calculateCost } from '@/lib/agents/cost'
import { resolveImageGenerationModel, type ImageGenerationModelId } from './imageModelCatalog'
import { prepareBriefForImageModel } from './briefValidation'
import type { PostGroundingContext } from './postGrounding'

export type ImageConcept = { message: string; headline: string; visual_idea: string; prompt: string }

const DEFAULT_BRIEF_MODEL = 'anthropic/claude-sonnet-5.5'

export function briefComposeModel(): string {
  return process.env.IMAGE_GENERATION_BRIEF_MODEL ?? DEFAULT_BRIEF_MODEL
}

export function imageOptionCount(): number {
  const n = Number(process.env.IMAGE_GENERATION_OPTIONS_COUNT ?? '3')
  return Number.isFinite(n) && n >= 1 && n <= 4 ? Math.floor(n) : 3
}

export function defaultImageModel(): string {
  return resolveImageGenerationModel(null).openRouterModel
}

/**
 * Craft rules for the brief writer (an LLM — it can handle "avoid X").
 * The image prompts it writes must be positive-only: image models treat any
 * object named in a prompt as something to draw, so "no laptop logo" yields laptops.
 */
function writerRules(count: number, modelId: ImageGenerationModelId | undefined): string {
  const textless = modelId === 'photoreal'
  return [
    '## How to work',
    `1. Find ${count} DIFFERENT ideas for this post — different messages or different visual metaphors, not ${count} layouts of one idea.`,
    '2. For each idea write: the message (one sentence a viewer should take away), the headline, a visual idea, then the image prompt.',
    textless
      ? '3. This image model renders no text: the picture alone carries the message; the headline goes in the caption.'
      : '3. Headline: at most 8 words, in the brand voice, saying the message. Adapt a headline angle when it fits. The post goal (Awareness, Leads…) is strategy and never appears in the headline.',
    '4. Visual idea: one concrete picture a viewer gets in one second that says the same thing as the headline. Pick one:',
    '   - a real person from this company\'s customers, in their own real place, in one specific moment (use the casting notes);',
    '   - one physical object that stands for the pain or the payoff, shot like a product photo;',
    textless ? '   - an abstract or textural image with a clear focal point.' : '   - type only: the headline as the hero on a color field with one graphic element.',
    '   Use at least two different kinds across the options.',
    '5. Generic business imagery is the failure: offices, meeting rooms, teams at tables, people smiling at laptops, handshakes, glowing networks. If the idea could illustrate any company, replace it.',
    '',
    '## The image prompt (this text goes straight to the image model)',
    '- 60 to 120 words, plain description, in this order: format and framing; subject; the moment or action; setting; composition',
    textless
      ? '  (where the eye lands); lighting; color palette and grade; photographic style (e.g. "35mm documentary photo, natural skin texture, shallow depth of field").'
      : '  (and where the headline sits); lighting; color palette and grade; style; then typography: the headline in double quotes exactly as written, its type style, and "This headline is the only text in the image."',
    '- Describe only what IS in the frame. Never mention anything that should be absent — no "no", "not", "never", "avoid" or "without". Naming a thing makes the image model draw it.',
    '- Colors as plain words ("deep charcoal", "electric blue accent"); type as plain words ("bold condensed sans"). No hex codes, token names or font names.',
    '- Logo and company name appear only when the brand block says the logo is included.',
  ].join('\n')
}

/** Compose N distinct grounded image briefs from Creative Direction + optional Brand Kit + post form. */
export async function composeImageBriefs(opts: {
  creativeDirectionBlock: string
  companyName: string
  sceneDirection?: string
  count?: number
  brandKitBlock?: string | null
  postContextBlock?: string | null
  postContext?: PostGroundingContext
  imageModelId?: ImageGenerationModelId
}): Promise<{
  briefs: string[]
  concepts: ImageConcept[]
  briefModel: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}> {
  const count = opts.count ?? imageOptionCount()
  const modelId = opts.imageModelId ?? resolveImageGenerationModel(null).id

  const sections = [
    `# Post images for ${opts.companyName}`,
    `Create ${count} options for one social post image.`,
    opts.postContextBlock?.trim() || '## This post\n(No post details given — choose the strongest message from the customer pain and headline angles below.)',
    opts.sceneDirection?.trim() ? `## Owner's notes for this run\n${opts.sceneDirection.trim()}` : '',
    `## The brand\n${opts.creativeDirectionBlock.trim()}`,
    opts.brandKitBlock?.trim()
      ? opts.brandKitBlock.trim()
      : '## Palette\nNo brand kit: use deep charcoal, white and one electric blue accent.',
    writerRules(count, modelId),
    `## Output\nJSON only: { "options": [ { "message": string, "headline": string, "visual_idea": string, "prompt": string } ] } with exactly ${count} items.`,
  ].filter(Boolean)

  const result = await openRouterComplete({
    model: briefComposeModel(),
    temperature: 0.8,
    max_tokens: 3000,
    messages: [
      {
        role: 'system',
        content:
          'You are a senior art director and copywriter at a small, sharp creative studio. You make social posts that look like a real designer and photographer made them for this specific business. Output ONLY valid JSON, no markdown fences.',
      },
      { role: 'user', content: sections.join('\n\n') },
    ],
  })

  const raw = result.content
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Brief compose did not return JSON: ${raw.slice(0, 400)}`)

  const parsed = JSON.parse(jsonMatch[0]) as { options?: Partial<ImageConcept>[]; briefs?: string[] }
  const concepts: ImageConcept[] = (parsed.options ?? [])
    .map(o => ({
      message: String(o.message ?? '').trim(),
      headline: String(o.headline ?? '').trim(),
      visual_idea: String(o.visual_idea ?? '').trim(),
      prompt: String(o.prompt ?? '').trim(),
    }))
    .filter(o => o.prompt)
  const rawBriefs = concepts.length > 0 ? concepts.map(c => c.prompt) : (parsed.briefs ?? []).map(b => b.trim()).filter(Boolean)
  if (rawBriefs.length < count) {
    throw new Error(`Expected ${count} image briefs, got ${rawBriefs.length}`)
  }
  const prepared = rawBriefs
    .slice(0, count)
    .map(brief => prepareBriefForImageModel(brief, modelId, opts.companyName, opts.postContext))

  const briefModel = briefComposeModel()
  const costUsd = await calculateCost(briefModel, result.inputTokens, result.outputTokens)

  return {
    briefs: prepared,
    concepts: concepts.slice(0, count),
    briefModel,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd,
  }
}
