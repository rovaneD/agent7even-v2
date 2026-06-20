import { openRouterComplete } from '@/lib/agents/openrouter'

const DEFAULT_BRIEF_MODEL = 'anthropic/claude-sonnet-4'

export function briefComposeModel(): string {
  return process.env.IMAGE_GENERATION_BRIEF_MODEL ?? DEFAULT_BRIEF_MODEL
}

export function imageOptionCount(): number {
  const n = Number(process.env.IMAGE_GENERATION_OPTIONS_COUNT ?? '3')
  return Number.isFinite(n) && n >= 1 && n <= 4 ? Math.floor(n) : 3
}

export function defaultImageModel(): string {
  return process.env.IMAGE_GENERATION_MODEL ?? 'google/gemini-2.5-flash-image'
}

/** Compose N distinct grounded image briefs from Foundation + optional user direction. */
export async function composeImageBriefs(opts: {
  foundationMarkdown: string
  companyName: string
  sceneDirection?: string
  count?: number
}): Promise<string[]> {
  const count = opts.count ?? imageOptionCount()
  const directionBlock = opts.sceneDirection?.trim()
    ? `\nOwner scene direction (honor if compatible with brand):\n${opts.sceneDirection.trim()}\n`
    : ''

  const kindSpec = `Write exactly ${count} distinct Instagram/LinkedIn POST IMAGE generation prompts for ${opts.companyName}.
Each prompt must be a self-contained paragraph (150-350 words) with: visual composition, color palette tied to brand (#3B82F6 primary blue, restrained pink #F5349B for logo moments only), typography/text to render ON the image, mood, what to avoid (generic AI slop, business-in-a-box templates).
Make the ${count} options visually distinct (e.g. carousel cover, stat/insight post with readable headline, quote/thought-leadership card — adapt to brand).
Ground every prompt in Voice, Position, and Customer from Foundation — not generic stock SaaS.
Do NOT mention "Foundation" — write as if briefing a designer.${directionBlock}`

  const result = await openRouterComplete({
    model: briefComposeModel(),
    temperature: 0.6,
    max_tokens: 4000,
    messages: [
      {
        role: 'system',
        content:
          'You are Maya, Agent7even\'s brand strategist. Output ONLY valid JSON: { "briefs": string[] } with the requested count. No markdown fences.',
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
  return briefs.slice(0, count)
}
