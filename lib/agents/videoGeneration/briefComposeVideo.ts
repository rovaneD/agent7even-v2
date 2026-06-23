import { openRouterComplete } from '@/lib/agents/openrouter'
import { briefComposeModel } from '@/lib/agents/imageGeneration/briefCompose'
import type { PostGroundingContext } from '@/lib/agents/imageGeneration/postGrounding'
import { prepareBriefForVideo } from './briefValidationVideo'
import { VIDEO_BRIEF_KIND_SPEC } from './videoBriefRules'

/** Compose a single video brief from Creative Direction + post form. */
export async function composeVideoBrief(opts: {
  creativeDirectionBlock: string
  companyName: string
  postContext?: PostGroundingContext
  postContextBlock?: string | null
  sceneDirection?: string
}): Promise<string> {
  const directionBlock = opts.sceneDirection?.trim()
    ? `\nOwner scene direction (honor if compatible with brand):\n${opts.sceneDirection.trim()}\n`
    : ''

  const postBlock = opts.postContextBlock?.trim()
    ? `\n${opts.postContextBlock.trim()}\n`
    : ''

  const result = await openRouterComplete({
    model: briefComposeModel(),
    temperature: 0.6,
    max_tokens: 1200,
    messages: [
      {
        role: 'system',
        content:
          'You are Maya, Agent7even\'s brand strategist and creative director. Output ONLY valid JSON: { "brief": string }. No markdown fences. Never put hex codes, Brand Kit color names, or font weights in brief strings — video models render them as visible text.',
      },
      {
        role: 'user',
        content: `${VIDEO_BRIEF_KIND_SPEC}

Write one 9:16 vertical short-form video brief (8 seconds) for ${opts.companyName}.
Constraints:
- 9:16 aspect ratio (vertical, Reels/TikTok)
- 8 seconds total — brief the opening 2s, middle 4s, closing 2s
- Text overlay: max 8 words in double quotes, tied to the post ask — specific to this company's offer or pain point
- Do NOT use generic filler like "Boost Your Brand", "Let's Connect", or "Your Success Starts Here"
- Do NOT mention "Foundation", "Creative Direction", or "Brand Kit"${postBlock}${directionBlock}

--- CREATIVE DIRECTION ---
${opts.creativeDirectionBlock.trim()}`,
      },
    ],
  })

  const raw = result.content
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Video brief compose did not return JSON: ${raw.slice(0, 300)}`)

  const parsed = JSON.parse(jsonMatch[0]) as { brief?: string }
  const brief = parsed.brief?.trim()
  if (!brief || brief.length < 50) throw new Error(`Video brief too short or empty: ${brief}`)

  return prepareBriefForVideo(brief, opts.companyName, opts.postContext)
}
