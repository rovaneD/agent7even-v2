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

export type VideoCritique = {
  scores: Array<{ index: number; readable: number; real_result: number; physics: number; craft: number; problems: string[] }>
  chosen: number
}

type Usage = { inputTokens: number; outputTokens: number; costUsd: number }

/**
 * Concept-first video writer, two passes:
 * 1. Writer — 8 seeds across different customer types, develops 3 full candidates in the given look.
 * 2. Critic — a separate call scores each candidate (readable with sound off, shows a real result,
 *    physically consistent, craft), picks one and returns it with every physical contradiction fixed.
 * Owner review 2026-10-17: symbolic ideas (blank paper slips = "a week of posts") don't read, and a
 * steaming cup described as untouched coffee rendered as an empty steaming cup.
 */
export async function composeVideoConcept(opts: {
  skill: VideoSkill
  creativeDirectionBlock: string
  companyName: string
  postContextBlock?: string | null
  sceneDirection?: string
  /** Force one look from the skill recipe (by name). Default: a random look, so repeat runs differ. */
  look?: string
}): Promise<{ concept: VideoConcept; ideas: string[]; candidates: VideoConcept[]; critique: VideoCritique | null; costUsd: number; inputTokens: number; outputTokens: number; model: string }> {
  const secs = opts.skill.duration_seconds
  const looks = recipeLooks(opts.skill.recipe)
  const look = opts.look && looks.includes(opts.look)
    ? opts.look
    : looks.length ? looks[Math.floor(Math.random() * looks.length)]! : null
  const model = briefComposeModel()

  const writerSections = [
    `Make one ${secs}-second vertical 9:16 social video for ${opts.companyName}.`,
    opts.postContextBlock?.trim() ? opts.postContextBlock.trim() : '',
    opts.sceneDirection?.trim() ? `Owner's scene direction (honor it):\n${opts.sceneDirection.trim()}` : '',
    `## Business and brand\n${opts.creativeDirectionBlock.trim()}`,
    `## Skill: ${opts.skill.name}\n${opts.skill.recipe}`,
    look ? `## Look for this video\nUse the "${look}" look.` : '',
    [
      '## What makes an idea work',
      '- It reads with the sound off in one viewing, before anyone sees the headline: a stranger can say what happened.',
      '- It shows a REAL result in the customer\'s world — the shop fills up, the line forms, the finished work appears, the chaos becomes the product. Real things of the trade, transformed.',
      '- Objects stand only for themselves. Blank paper, tags, cards, circles or rows of seven never "stand for" posts, days or a schedule — a viewer cannot decode that.',
      '- One surprising visual move (scale, transformation, reveal) carries it. If you need to explain the metaphor, it is the wrong idea.',
    ].join('\n'),
    [
      '## Method',
      '1. Write 8 one-line idea seeds spread across at least 4 different kinds of this business\'s customers (vary the trade, the place and the time of day — never default to a bakery or café). Cut seeds that are literal (someone reading a phone, smiling at a screen), generic business imagery (offices, teams at laptops, handshakes, dashboards, glowing networks), symbolic stand-ins, or could advertise any company.',
      '2. Develop the 3 strongest survivors into full candidates.',
      '3. Each candidate gets a headline: the hook line we place over the video, max 7 words, specific and a little witty, in the owner\'s voice.',
    ].join('\n'),
    promptRules(secs),
    '## Output\nJSON only: { "ideas": string[8], "candidates": [ { "look": string, "idea": string, "headline": string, "prompt": string } ] } with exactly 3 candidates.',
  ].filter(Boolean)

  const writer = await openRouterComplete({
    model,
    temperature: 0.9,
    max_tokens: 3500,
    messages: [
      {
        role: 'system',
        content: 'You are the creative director of a small, sharp motion studio. You make short social videos that look crafted for this specific business — an idea first, then craft. Output ONLY valid JSON, no markdown fences.',
      },
      { role: 'user', content: writerSections.join('\n\n') },
    ],
  })
  const w = parseJson<{ ideas?: unknown[]; candidates?: Partial<VideoConcept>[] }>(writer.content, 'writer')
  const candidates: VideoConcept[] = (w.candidates ?? [])
    .map(c => ({
      look: String(c.look ?? look ?? '').trim(),
      idea: String(c.idea ?? '').trim(),
      headline: cleanHeadline(c.headline),
      prompt: String(c.prompt ?? '').trim(),
    }))
    .filter(c => c.prompt.length >= 60)
  if (!candidates.length) throw new Error('Video writer returned no usable candidates')

  const usage: Usage = { inputTokens: writer.inputTokens, outputTokens: writer.outputTokens, costUsd: 0 }
  let chosen = candidates[0]!
  let critique: VideoCritique | null = null
  for (let attempt = 0; attempt < 2 && !critique; attempt++) try {
    const critic = await openRouterComplete({
      model,
      temperature: 0.2,
      max_tokens: 2500,
      messages: [
        {
          role: 'system',
          content: 'You are a demanding executive creative director reviewing short social video concepts before they go to render. You are blunt and specific. Output ONLY valid JSON, no markdown fences.',
        },
        {
          role: 'user',
          content: [
            `Business: ${opts.companyName}.`,
            opts.postContextBlock?.trim() ?? '',
            '## Candidates',
            candidates.map((c, i) => `[${i}] look: ${c.look}\nidea: ${c.idea}\nheadline: ${c.headline}\nprompt: ${c.prompt}`).join('\n\n'),
            [
              '## Score each 1–5',
              '- readable: with the sound off and no headline, would a stranger get what happened in one viewing?',
              '- real_result: does it show a real result in the customer\'s world (not symbols standing in for posts, days or schedules)?',
              '- physics: is every detail physically consistent? Check each object: steam needs a hot full drink, a cutter makes the shape it is said to make, counts and positions stay stable, nothing appears from nowhere. List every contradiction in problems.',
              '- craft: would a good studio put this in its portfolio?',
            ].join('\n'),
            [
              '## Then',
              'Pick the candidate with the best total, weighting readable and real_result double. Return it with its prompt corrected: remove or fix every listed physics problem, cut any object that is not needed for the idea (three key objects at most), keep everything else.',
              promptRules(secs),
            ].join('\n'),
            '## Output\nJSON only: { "scores": [ { "index": number, "readable": number, "real_result": number, "physics": number, "craft": number, "problems": string[] } ], "chosen": number, "final": { "look": string, "idea": string, "headline": string, "prompt": string } }',
          ].filter(Boolean).join('\n\n'),
        },
      ],
    })
    usage.inputTokens += critic.inputTokens
    usage.outputTokens += critic.outputTokens
    const c = parseJson<{ scores?: VideoCritique['scores']; chosen?: number; final?: Partial<VideoConcept> }>(critic.content, 'critic')
    const idx = typeof c.chosen === 'number' && candidates[c.chosen] ? c.chosen : 0
    critique = { scores: Array.isArray(c.scores) ? c.scores : [], chosen: idx }
    const base = candidates[idx]!
    const finalPrompt = String(c.final?.prompt ?? '').trim()
    chosen = {
      look: String(c.final?.look ?? base.look).trim() || base.look,
      idea: String(c.final?.idea ?? base.idea).trim() || base.idea,
      headline: cleanHeadline(c.final?.headline) || base.headline,
      prompt: finalPrompt.length >= 60 ? finalPrompt : base.prompt,
    }
  } catch (err) {
    console.warn(`[video-concept] critic attempt ${attempt + 1} failed`, err instanceof Error ? err.message : err)
  }

  usage.costUsd = await calculateCost(model, usage.inputTokens, usage.outputTokens)
  return {
    concept: { ...chosen, prompt: finalizeVideoPrompt(chosen.prompt, opts.companyName) },
    ideas: Array.isArray(w.ideas) ? w.ideas.map(String).slice(0, 12) : [],
    candidates,
    critique,
    ...usage,
    model,
  }
}

function promptRules(secs: number): string {
  return [
    '## Writing the prompt (sent straight to the video model)',
    `- 70–130 words, present tense, one continuous ${secs}-second shot, vertical 9:16.`,
    '- Order: look and medium → setting and materials → the action beat by beat → camera move → light and palette → texture.',
    '- One clear action that builds to a payoff by the last second. Objects can move by themselves; people move their whole body or face.',
    '- Three key objects at most. Every object is physically consistent from first frame to last: if something steams, say what hot drink fills it; state shapes and counts plainly and keep them stable.',
    '- Keep every object where it starts: nothing small is picked up, handed over or carried (phones, cups, cards). Video models lose small held objects.',
    '- Describe only what IS in frame. Write positively; leave out anything that should not appear.',
    '- No words, letters, signs with copy, logos, brand names or screens in the scene. Storefront sign boards, awnings and windows are plain painted surfaces in one color (models invent garbled lettering on any sign). The headline is added later by us.',
    '- Plain-English colors and light; no hex codes, font names or design-system terms.',
  ].join('\n')
}

function parseJson<T>(raw: string, label: string): T {
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) throw new Error(`Video ${label} did not return JSON: ${raw.slice(0, 300)}`)
  return JSON.parse(m[0]) as T
}

function cleanHeadline(h: unknown): string {
  return String(h ?? '').trim().replace(/^["“]|["”]$/g, '')
}

/** Look names from recipe lines shaped "- Name: description". */
export function recipeLooks(recipe: string): string[] {
  return [...recipe.matchAll(/^\s*-\s*([^:\n]{3,40}):/gm)].map(m => m[1]!.trim())
}

/** Positive-only, no company name, no quoted copy (video models render quotes as garbled text). */
export function finalizeVideoPrompt(prompt: string, companyName: string): string {
  let p = stripDesignSpecsFromBrief(prompt)
  p = dropNegativeSentences(p)
  p = scrubCompanyName(p, companyName)
  p = p.replace(/["“][^"”]{1,80}["”]/g, '').replace(/\s{2,}/g, ' ').trim()
  return p
}
