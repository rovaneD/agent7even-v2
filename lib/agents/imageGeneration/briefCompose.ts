import { openRouterComplete } from '@/lib/agents/openrouter'
import { resolveImageGenerationModel, type ImageGenerationModelId } from './imageModelCatalog'
import { prepareBriefForImageModel } from './briefValidation'
import { GLOBAL_IMAGE_BRIEF_RULES, modelBriefRulesBlock } from './modelBriefRules'

const DEFAULT_BRIEF_MODEL = 'anthropic/claude-sonnet-4'

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

function optionDiversityLine(count: number, modelId?: ImageGenerationModelId): string {
  switch (modelId) {
    case 'photoreal':
      return `Make the ${count} options visually distinct but cohesive: editorial photograph, symbolic object close-up, environmental wide shot, or abstract texture — NEVER bar charts, infographics, pillar diagrams, stat dashboards, or UI mockups.`
    case 'sharp-text':
      return `Make the ${count} options visually distinct: bold headline card, stat callout with one number, quote card — readable typography is the point; NEVER logo lockups, wordmarks, monograms, or abstract brand-mark tiles.`
    default:
      return `Make the ${count} options visually distinct but cohesive with the same brand system — vary layout archetype, not generic stock templates.`
  }
}

/** Compose N distinct grounded image briefs from Foundation + optional Brand Kit + user direction. */
export async function composeImageBriefs(opts: {
  foundationMarkdown: string
  companyName: string
  sceneDirection?: string
  count?: number
  brandKitBlock?: string | null
  postContextBlock?: string | null
  imageModelId?: ImageGenerationModelId
}): Promise<string[]> {
  const count = opts.count ?? imageOptionCount()
  const directionBlock = opts.sceneDirection?.trim()
    ? `\nOwner scene direction (honor if compatible with brand):\n${opts.sceneDirection.trim()}\n`
    : ''

  const brandBlock = opts.brandKitBlock?.trim()
    ? `\n${opts.brandKitBlock.trim()}\n`
    : `\nUse Agent7even platform palette only when no Brand Kit colors are provided: primary #3B82F6, restrained pink #F5349B for logo moments.\n`

  const postBlock = opts.postContextBlock?.trim()
    ? `\n${opts.postContextBlock.trim()}\n`
    : ''

  const modelBlock = opts.imageModelId
    ? `\n${modelBriefRulesBlock(opts.imageModelId)}\n`
    : ''

  const diversityLine = optionDiversityLine(count, opts.imageModelId)

  const kindSpec = `${GLOBAL_IMAGE_BRIEF_RULES}${modelBlock}
Write exactly ${count} distinct Instagram/LinkedIn POST IMAGE generation prompts for ${opts.companyName}.
Each prompt must be a self-contained paragraph (150-350 words) describing visual composition, mood, and what to avoid (generic AI slop, business-in-a-box templates).
Brief text is sent directly to the image model — write plain creative direction only:
- Do NOT paste hex codes, color token names, or font specs into the brief (they become visible labels on the image).
- Describe palette as "warm amber accent", "deep slate", "clean white background" — not "Insight Amber (#F59E0B)".
- Describe typography as "bold sans headline" — not "Inter weight 700".
${opts.imageModelId === 'photoreal'
    ? '- Photoreal: describe a photograph or abstract scene only — no headlines, charts, infographics, or on-image text in the brief.'
    : '- If on-image text is appropriate for this model, quote the marketing words only (e.g. headline: "Results Without Reports") — never font or color specs.'}
${diversityLine}
Ground every prompt in Voice, Position, and Customer from Foundation — not generic stock SaaS.
Do NOT mention "Foundation" or "Brand Kit" — write as if briefing a designer.${brandBlock}${postBlock}${directionBlock}`

  const result = await openRouterComplete({
    model: briefComposeModel(),
    temperature: 0.6,
    max_tokens: 4000,
    messages: [
      {
        role: 'system',
        content:
          'You are Maya, Agent7even\'s brand strategist. Output ONLY valid JSON: { "briefs": string[] } with the requested count. No markdown fences. Never put hex codes, Brand Kit color names, or font weights in brief strings — image models render them as visible text.',
      },
      {
        role: 'user',
        content: `${kindSpec}\n\n--- FOUNDATION ---\n${opts.foundationMarkdown.slice(0, 28000)}`,
      },
    ],
  })

  const raw = result.content
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Brief compose did not return JSON: ${raw.slice(0, 400)}`)

  const parsed = JSON.parse(jsonMatch[0]) as { briefs?: string[] }
  const briefs = (parsed.briefs ?? []).map(b => b.trim()).filter(Boolean)
  if (briefs.length < count) {
    throw new Error(`Expected ${count} image briefs, got ${briefs.length}`)
  }
  const modelId = opts.imageModelId ?? resolveImageGenerationModel(null).id
  return briefs
    .slice(0, count)
    .map(brief => prepareBriefForImageModel(brief, modelId, opts.companyName))
}
