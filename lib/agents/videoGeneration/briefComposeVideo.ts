import { openRouterComplete } from '@/lib/agents/openrouter'
import { briefComposeModel } from '@/lib/agents/imageGeneration/briefCompose'

export const VIDEO_BRIEF_RULES = `## Hard rules (video brief)
- NEVER include hex codes (#RRGGBB), bare hex values, or color token names in the brief text — describe colors as "warm terracotta accent", "deep slate", "clean white" — not "#B5451B" or "Insight Amber".
- NEVER copy font family names or weights (e.g. "Inter weight 700") — say "bold sans headline" or "bold display text".
- NEVER mention "Foundation" or "Brand Kit" as design system terms — write as if briefing a video director.
- NEVER invent fake customer testimonials, people, or unrelated industries.
- Stay in the business category described in Foundation — no random lifestyle or stock scenarios unrelated to the product.
- On-screen text overlay must be real marketing words only (max 8 words) — not brief instructions or model names.
- Describe motion as storytelling: "camera slowly zooms in", "text slides up from bottom", "scene fades through multiple customer moments" — not technical specs.`

/** Compose a single video brief from Foundation + post goal. */
export async function composeVideoBrief(opts: {
  foundationMarkdown: string
  companyName: string
  postGoal: string
  platform?: string
  offer?: string
  audience?: string
  sceneDirection?: string
}): Promise<string> {
  const { companyName, postGoal, platform, offer, audience, sceneDirection } = opts

  const platformLine = platform ? `Platform: ${platform}.` : 'Platform: Instagram Reels / TikTok.'
  const offerLine = offer ? `Offer / CTA: ${offer}.` : ''
  const audienceLine = audience ? `Target audience: ${audience}.` : ''
  const directionLine = sceneDirection?.trim() ? `Scene direction from creator: ${sceneDirection.trim()}` : ''

  const postBlock = [platformLine, offerLine, audienceLine].filter(Boolean).join(' ')

  const systemPrompt = `You are Maya, Agent7even's brand strategist and creative director. Output ONLY valid JSON: { "brief": string }. No markdown fences.

${VIDEO_BRIEF_RULES}

The brief is a single paragraph (120-220 words) sent directly to a video generation model. It must describe:
1. SCENE DIRECTION: what happens visually — opening shot, key action, closing shot (be specific to this business)
2. VISUAL TONE: lighting, color palette (described in plain English — warm, cool, high contrast, clean, etc.), energy level
3. MOTION STYLE: how the camera moves and how text enters ("text fades in center-frame", "quick cuts between product close-ups", etc.)
4. TEXT OVERLAY COPY: exactly 1–2 lines of on-screen text (max 8 words total) tied directly to the post goal — must be specific marketing copy, NOT generic filler like "Grow Your Business"

The brief must be grounded in this company's specific product/service, not generic stock video scenes.`

  const userPrompt = `${VIDEO_BRIEF_RULES}

Write a 9:16 vertical short-form video brief (8 seconds) for ${companyName}.
Post goal: ${postGoal}
${postBlock}
${directionLine}

Constraints:
- 9:16 aspect ratio (vertical, Reels/TikTok)
- 8 seconds total — brief the opening 2s, middle 4s, closing 2s
- Text overlay: max 8 words, tied to the post goal — make it specific to this company's offer or pain point
- Do NOT use generic filler text like "Boost Your Brand", "Let's Connect", or "Your Success Starts Here"
- Colors: describe as "warm amber", "clean white", "deep navy" — never hex codes
- If a scene includes product UI, describe it as "a blurred dashboard UI in the background" — no fake data labels

--- FOUNDATION ---
${opts.foundationMarkdown.slice(0, 18000)}`

  const result = await openRouterComplete({
    model: briefComposeModel(),
    temperature: 0.65,
    max_tokens: 1200,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const raw = result.content
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Video brief compose did not return JSON: ${raw.slice(0, 300)}`)

  const parsed = JSON.parse(jsonMatch[0]) as { brief?: string }
  const brief = parsed.brief?.trim()
  if (!brief || brief.length < 50) throw new Error(`Video brief too short or empty: ${brief}`)

  return stripDesignTokenLeaks(brief)
}

const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g
const COLOR_TOKEN_PATTERN = /\b(growth green|strategic slate|insight amber|brand blue|platform blue|restrained pink)\b/gi
const FONT_SPEC_PATTERN = /\b(inter|helvetica|montserrat|lato|poppins|gilroy)\s+(weight\s+)?\d{3}\b/gi

function stripDesignTokenLeaks(brief: string): string {
  return brief
    .replace(HEX_PATTERN, '')
    .replace(COLOR_TOKEN_PATTERN, '')
    .replace(FONT_SPEC_PATTERN, '')
    .replace(/\(\s*\)/g, '')
    .trim()
}
