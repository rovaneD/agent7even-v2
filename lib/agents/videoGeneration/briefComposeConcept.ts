import { openRouterComplete } from '@/lib/agents/openrouter'
import { calculateCost } from '@/lib/agents/cost'
import { briefComposeModel } from '@/lib/agents/imageGeneration/briefCompose'
import { dropNegativeSentences, scrubCompanyName, stripDesignSpecsFromBrief } from '@/lib/agents/imageGeneration/briefValidation'
import type { VideoSkill } from './videoSkills'

export type VideoConcept = {
  look: string
  idea: string
  /** Hook line for the overlay / caption — never sent to the video model. */
  headline: string
  prompt: string
}

/**
 * Concept-first video writer (same method as images): 8 idea seeds, a critic cuts literal / stock /
 * any-company ideas, develop the strongest into one shot written for what video models do well.
 */
export async function composeVideoConcept(opts: {
  skill: VideoSkill
  creativeDirectionBlock: string
  companyName: string
  postContextBlock?: string | null
  sceneDirection?: string
}): Promise<{ concept: VideoConcept; ideas: string[]; costUsd: number; inputTokens: number; outputTokens: number; model: string }> {
  const secs = opts.skill.duration_seconds
  const sections = [
    `Make one ${secs}-second vertical 9:16 social video for ${opts.companyName}.`,
    opts.postContextBlock?.trim() ? opts.postContextBlock.trim() : '',
    opts.sceneDirection?.trim() ? `Owner's scene direction (honor it):\n${opts.sceneDirection.trim()}` : '',
    `## Business and brand\n${opts.creativeDirectionBlock.trim()}`,
    `## Skill: ${opts.skill.name}\n${opts.skill.recipe}`,
    [
      '## Method',
      '1. Write 8 one-line idea seeds. Each is a visual metaphor or tiny story about THIS business\'s customers and what changes for them. Cut every seed that: shows the message literally (someone reading a phone notification, someone smiling at a screen); uses generic business imagery (offices, meeting rooms, teams at laptops, handshakes, glowing networks, dashboards); or could advertise any company.',
      '2. Develop the strongest survivor into ONE continuous shot.',
      '3. Write a headline: the hook line we will place over the video, max 7 words, specific and a little witty, in the owner\'s voice. It is never part of the scene.',
    ].join('\n'),
    [
      '## Writing the prompt (sent straight to the video model)',
      `- 70–130 words, present tense, one continuous ${secs}-second shot, vertical 9:16.`,
      '- Order: look and medium → setting and materials → the action beat by beat → camera move → light and palette → texture.',
      '- One clear action that builds to a payoff by the last second. Objects can move by themselves; people move their whole body or face.',
      '- Keep every object where it starts: nothing small is picked up, handed over or carried (phones, cups, cards). Video models lose small held objects.',
      '- Describe only what IS in frame. Write positively; leave out anything that should not appear.',
      '- No words, letters, signs with copy, logos, brand names or screens in the scene. The headline is added later by us.',
      '- Plain-English colors and light; no hex codes, font names or design-system terms.',
    ].join('\n'),
    '## Output\nJSON only: { "ideas": string[8], "look": string, "idea": string, "headline": string, "prompt": string }',
  ].filter(Boolean)

  const model = briefComposeModel()
  const result = await openRouterComplete({
    model,
    temperature: 0.85,
    max_tokens: 2000,
    messages: [
      {
        role: 'system',
        content: 'You are the creative director of a small, sharp motion studio. You make short social videos that look crafted for this specific business — an idea first, then craft. Output ONLY valid JSON, no markdown fences.',
      },
      { role: 'user', content: sections.join('\n\n') },
    ],
  })

  const m = result.content.match(/\{[\s\S]*\}/)
  if (!m) throw new Error(`Video concept did not return JSON: ${result.content.slice(0, 300)}`)
  const parsed = JSON.parse(m[0]) as Partial<VideoConcept> & { ideas?: unknown[] }
  const rawPrompt = String(parsed.prompt ?? '').trim()
  if (rawPrompt.length < 60) throw new Error('Video concept prompt too short')

  const prompt = finalizeVideoPrompt(rawPrompt, opts.companyName)
  return {
    concept: {
      look: String(parsed.look ?? '').trim(),
      idea: String(parsed.idea ?? '').trim(),
      headline: String(parsed.headline ?? '').trim().replace(/^["“]|["”]$/g, ''),
      prompt,
    },
    ideas: Array.isArray(parsed.ideas) ? parsed.ideas.map(String).slice(0, 12) : [],
    costUsd: await calculateCost(model, result.inputTokens, result.outputTokens),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    model,
  }
}

/** Positive-only, no company name, no quoted copy (video models render quotes as garbled text). */
export function finalizeVideoPrompt(prompt: string, companyName: string): string {
  let p = stripDesignSpecsFromBrief(prompt)
  p = dropNegativeSentences(p)
  p = scrubCompanyName(p, companyName)
  p = p.replace(/["“][^"”]{1,80}["”]/g, '').replace(/\s{2,}/g, ' ').trim()
  return p
}
