import { openRouterComplete } from '@/lib/agents/openrouter'
import { calculateCost } from '@/lib/agents/cost'
import { resolveImageGenerationModel } from './imageModelCatalog'
import { prepareBriefForImageModel } from './briefValidation'
import type { PostGroundingContext } from './postGrounding'
import type { PostStyle } from './postStyles'

export type ImageConcept = { style_id: string; message: string; headline: string; visual_idea: string; prompt: string }

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
function writerRules(count: number, styles: PostStyle[], mode: 'fixed' | 'auto', logoAvailable: boolean): string {
  const styleMenu = styles
    .map(st => `### ${st.id} — ${st.name}\n${st.recipe}${st.uses_logo && logoAvailable ? '\nThe real logo is attached as an image for this style.' : ''}`)
    .join('\n\n')
  const styleRule = mode === 'fixed'
    ? `Every option uses the style "${styles[0]!.id}" — ${count} different ideas in that one style.`
    : `Give each option a different style from the menu, choosing the style that best fits each idea.`
  return [
    '## Styles',
    styleMenu,
    '',
    '## How to work',
    `1. Write 8 one-line idea seeds for this post. Cut every seed that: shows the headline literally (a person holding the thing the copy names); uses generic business imagery (offices, meeting rooms, teams at laptops, handshakes, glowing networks); or could advertise any company. Develop the ${count} strongest survivors.`,
    `2. ${styleRule}`,
    '3. For each option write: style_id, the message (one sentence a viewer takes away), the headline (the main words in the image — a cover line, a caption, the writing on the object — at most 12 words, in the brand voice), the visual idea, then the image prompt.',
    '4. The post goal (Awareness, Leads…) is strategy and never appears as words in the image.',
    '5. Prefer the specific over the general: a real kind of customer from the casting notes, a real object from their day, real numbers, a real moment.',
    '',
    '## The image prompt (this text goes straight to the image model)',
    '- 60 to 130 words, plain description: format and framing; subject; moment; setting; composition; lighting; palette and grade; style; then typography — every word that appears in the image, in double quotes exactly as written, with its type style, ending with "These are the only words in the image."',
    '- Describe only what IS in the frame. Never mention anything that should be absent — no "no", "not", "never", "avoid" or "without". Naming a thing makes the image model draw it.',
    '- Colors as plain words ("deep charcoal", "butter yellow"); type as plain words ("bold condensed serif", "faded thermal print"). No hex codes, token names or font names.',
    logoAvailable
      ? '- In styles where the real logo is attached, say where it sits ("the attached logo printed small at the bottom of the card"). Never describe or redraw the logo design itself, and never write the company name as text.'
      : '- The company name and any logo stay out of the image.',
  ].join('\n')
}

function frameWords(ratio?: string): string {
  switch (ratio) {
    case '1:1': return 'square'
    case '9:16': return 'tall vertical'
    case '16:9': return 'wide horizontal'
    case '1.91:1': return 'wide horizontal'
    default: return 'vertical portrait'
  }
}

/** Compose N distinct, style-tagged image briefs from Creative Direction + Brand Kit + post form. */
export async function composeImageBriefs(opts: {
  creativeDirectionBlock: string
  companyName: string
  sceneDirection?: string
  count?: number
  brandKitBlock?: string | null
  postContextBlock?: string | null
  postContext?: PostGroundingContext
  styles: PostStyle[]
  styleMode: 'fixed' | 'auto'
  logoAvailable: boolean
  /** The frame the image model renders — the prompt must describe the same one. */
  aspectRatio?: string
}): Promise<{
  briefs: string[]
  concepts: ImageConcept[]
  ideas: string[]
  briefModel: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}> {
  const count = opts.count ?? imageOptionCount()

  const sections = [
    `# Post images for ${opts.companyName}`,
    `Create ${count} options for one social post image. Frame: ${opts.aspectRatio ?? '4:5'} (${frameWords(opts.aspectRatio)}). Every prompt opens with exactly this frame, and keeps all words and the subject at least 8% inside every edge.`,
    opts.postContextBlock?.trim() || '## This post\n(No post details given — choose the strongest message from the customer pain and headline angles below.)',
    opts.sceneDirection?.trim() ? `## Owner's notes for this run\n${opts.sceneDirection.trim()}` : '',
    `## The brand\n${opts.creativeDirectionBlock.trim()}`,
    opts.brandKitBlock?.trim()
      ? opts.brandKitBlock.trim()
      : '## Palette\nNo brand kit: choose a tight palette that suits the style.',
    writerRules(count, opts.styles, opts.styleMode, opts.logoAvailable),
    `## Output\nJSON only: { "ideas": string[8], "options": [ { "style_id": string, "message": string, "headline": string, "visual_idea": string, "prompt": string } ] } with exactly ${count} options.`,
  ].filter(Boolean)

  const result = await openRouterComplete({
    model: briefComposeModel(),
    temperature: 0.85,
    max_tokens: 4000,
    messages: [
      {
        role: 'system',
        content:
          'You are the creative director of a small, sharp design studio. You make social posts that look like a real designer and photographer made them for this specific business — an idea first, then craft. Output ONLY valid JSON, no markdown fences.',
      },
      { role: 'user', content: sections.join('\n\n') },
    ],
  })

  const raw = result.content
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Brief compose did not return JSON: ${raw.slice(0, 400)}`)

  const parsed = JSON.parse(jsonMatch[0]) as { options?: Partial<ImageConcept>[]; briefs?: string[]; ideas?: unknown[] }
  const validStyle = new Set(opts.styles.map(st => st.id))
  const concepts: ImageConcept[] = (parsed.options ?? [])
    .map((o, i) => ({
      style_id: validStyle.has(String(o.style_id)) ? String(o.style_id) : opts.styles[i % opts.styles.length]!.id,
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
  const byId = new Map(opts.styles.map(st => [st.id, st]))
  const prepared = rawBriefs
    .slice(0, count)
    .map((brief, i) => {
      const style = byId.get(concepts[i]?.style_id ?? '')
      const keepLogo = Boolean(style?.uses_logo && opts.logoAvailable)
      return prepareBriefForImageModel(brief, 'balanced', opts.companyName, opts.postContext, { allowLogo: keepLogo })
    })

  const briefModel = briefComposeModel()
  const costUsd = await calculateCost(briefModel, result.inputTokens, result.outputTokens)

  return {
    briefs: prepared,
    concepts: concepts.slice(0, count),
    ideas: Array.isArray(parsed.ideas) ? parsed.ideas.map(String).slice(0, 12) : [],
    briefModel,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd,
  }
}
