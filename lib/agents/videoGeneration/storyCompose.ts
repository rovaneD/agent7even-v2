import { openRouterComplete } from '@/lib/agents/openrouter'
import { calculateCost } from '@/lib/agents/cost'
import { briefComposeModel } from '@/lib/agents/imageGeneration/briefCompose'
import { finalizeVideoPrompt, recipeLooks } from './briefComposeConcept'
import type { VideoSkill } from './videoSkills'

/**
 * Story-first short video (owner review 2026-10-18: a single 5s moment has no beginning, middle or
 * end and gives the viewer nothing to take away). A story is three beats, each with an on-screen line,
 * a takeaway the viewer keeps, and an end card. Text is ours (overlay), never drawn by the model.
 *
 * Render plan: 'single' = one continuous 10s clip (story stays in one place/time; camera can move);
 * 'multi' = 2–3 separate 5s shots joined (time jumps, before/after, location changes) — tested
 * 2026-10-18: one clip could not hold a night→morning cut.
 */
export type StoryBeat = { role: 'hook' | 'turn' | 'payoff'; line: string; visual: string }
export type StoryShot = { prompt: string; seconds: 5 | 10 }
export type VideoStory = {
  look: string
  idea: string
  takeaway: string
  beats: StoryBeat[]
  end_card: string
  mode: 'single' | 'multi'
  shots: StoryShot[]
  /** Overlay timeline in seconds over the joined video. */
  timeline: Array<{ start: number; end: number; text: string }>
}

export async function composeVideoStory(opts: {
  skill: VideoSkill
  creativeDirectionBlock: string
  companyName: string
  brandUrl?: string | null
  postContextBlock?: string | null
  sceneDirection?: string
  look?: string
}): Promise<{ story: VideoStory; candidates: unknown[]; critique: unknown; ideas: string[]; costUsd: number; inputTokens: number; outputTokens: number; model: string }> {
  const looks = recipeLooks(opts.skill.recipe)
  const look = opts.look && looks.includes(opts.look)
    ? opts.look
    : looks.length ? looks[Math.floor(Math.random() * looks.length)]! : null
  const model = briefComposeModel()

  const storyRules = [
    '## A story the viewer keeps',
    '- HOOK (0–3s): a tension the viewer recognizes from their own work — a problem, a frustration, a surprising contrast. Line max 7 words. It must make a scrolling owner stop.',
    '- TURN (3–6s): what changes or what they did not know. Line max 9 words.',
    '- PAYOFF (6–10s): the visible result. Line max 8 words.',
    '- TAKEAWAY: one sentence the viewer could repeat to a friend and act on even if they never buy anything — an insight, a habit, a truth about customers. The payoff line usually carries it.',
    '- END CARD: the brand line, max 6 words, plus the website if given. The brand appears only here.',
    '- Every beat\'s picture shows what its line says. A stranger watching with sound off and text on follows the whole story.',
    '- Show real results in the customer\'s world (chairs fill, a line forms, the finished work appears). Objects stand only for themselves — no paper, tags or rows standing in for posts or days.',
  ].join('\n')

  const renderRules = [
    '## Render plan',
    '- mode "single": the whole story happens in ONE continuous place and time and the camera can reveal it (a slow move across a miniature street, a push-in, a crane). One 10-second shot prompt describing the three beats in order with their timings.',
    '- mode "multi": the story needs a time jump (night → morning), a before/after, or a change of place. Write 2 or 3 separate 5-second shots, one per beat (hook+turn may share one). Each shot prompt stands alone: repeat the same one-sentence description of any recurring person and place word for word in every shot, and make the light match the time of day (night = dark windows and lamp light; morning = sunlight).',
    '- Prefer "single" when the idea allows it — continuity is stronger.',
    '## Shot prompts (sent straight to the video model)',
    '- Vertical 9:16, present tense; single: 110–170 words; multi: 60–110 words each.',
    '- Order: look and medium → setting and materials → action beat by beat → camera move → light and palette → texture.',
    '- Three key objects at most per shot; every object physically consistent first frame to last (steam needs a hot full drink; counts and shapes stay stable; the floor is swept if time has passed).',
    '- Nothing small is picked up, handed over or carried (phones, cups, cards).',
    '- No words, letters, logos, brand names or screens in any shot; sign boards, awnings and windows are plain painted surfaces in one color. Our text is added afterwards.',
    '- Describe only what IS in frame, positively. Plain-English colors and light.',
  ].join('\n')

  const outputShape = '{ "look": string, "idea": string, "takeaway": string, "beats": [ { "role": "hook"|"turn"|"payoff", "line": string, "visual": string } ], "end_card": string, "mode": "single"|"multi", "shots": [ { "prompt": string, "seconds": 5|10 } ] }'

  const writer = await openRouterComplete({
    model,
    temperature: 0.9,
    max_tokens: 6000,
    messages: [
      { role: 'system', content: 'You are the creative director of a sharp short-form video studio. Every video you make tells a tiny story with a hook, a turn and a payoff, and leaves the viewer with something useful. Output ONLY valid JSON, no markdown fences.' },
      {
        role: 'user',
        content: [
          `Make one 10-second vertical 9:16 social video story for ${opts.companyName}.${opts.brandUrl ? ` Website for the end card: ${opts.brandUrl}.` : ''}`,
          opts.postContextBlock?.trim() ?? '',
          opts.sceneDirection?.trim() ? `Owner's scene direction (honor it):\n${opts.sceneDirection.trim()}` : '',
          `## Business and brand\n${opts.creativeDirectionBlock.trim()}`,
          `## Skill: ${opts.skill.name}\n${opts.skill.recipe}`,
          look ? `## Look for this video\nUse the "${look}" look.` : '',
          storyRules,
          '## Method\n1. Write 8 one-line story seeds across at least 4 different kinds of this business\'s customers (vary trade, place, time of day — never default to a bakery or café). Cut literal ones (someone reading a phone), generic business imagery (offices, laptops, handshakes, dashboards) and any-company ideas.\n2. Develop the 3 strongest into full stories.',
          renderRules,
          `## Output\nJSON only: { "ideas": string[8], "candidates": [ ${outputShape} ] } with exactly 3 candidates.`,
        ].filter(Boolean).join('\n\n'),
      },
    ],
  })
  const w = parseJson<{ ideas?: unknown[]; candidates?: unknown[] }>(writer.content, 'story writer')
  const candidates = (w.candidates ?? []).map(normalizeStory).filter((s): s is VideoStory => s !== null)
  if (!candidates.length) throw new Error('Story writer returned no usable stories')

  let inputTokens = writer.inputTokens
  let outputTokens = writer.outputTokens
  let story = candidates[0]!
  let critique: unknown = null
  for (let attempt = 0; attempt < 2 && !critique; attempt++) {
    try {
      const critic = await openRouterComplete({
        model,
        temperature: 0.2,
        max_tokens: 5000,
        messages: [
          { role: 'system', content: 'You are a demanding executive creative director reviewing short social video stories before render. Blunt and specific. Output ONLY valid JSON, no markdown fences.' },
          {
            role: 'user',
            content: [
              `Business: ${opts.companyName}.`,
              opts.postContextBlock?.trim() ?? '',
              '## Stories',
              candidates.map((c, i) => `[${i}] ${JSON.stringify(c)}`).join('\n\n'),
              '## Score each 1–5\n- hook: would an owner scrolling past stop on the first 3 seconds?\n- takeaway: does the viewer leave with something useful they could act on even without buying?\n- beats_match: does each beat\'s picture show what its line says, so the story is followable with sound off?\n- physics: every object, light and time-of-day detail consistent within and across shots? List each problem.\n- craft: portfolio-worthy?',
              `## Then\nPick the best total (hook and takeaway count double). Return it fixed: correct every physics or continuity problem, make the render plan match the story (any time jump or place change = "multi"), tighten the lines.\n${storyRules}\n${renderRules}`,
              `## Output\nJSON only: { "scores": [ { "index": number, "hook": number, "takeaway": number, "beats_match": number, "physics": number, "craft": number, "problems": string[] } ], "chosen": number, "final": ${outputShape} }`,
            ].filter(Boolean).join('\n\n'),
          },
        ],
      })
      inputTokens += critic.inputTokens
      outputTokens += critic.outputTokens
      const c = parseJson<{ scores?: unknown[]; chosen?: number; final?: unknown }>(critic.content, 'story critic')
      const idx = typeof c.chosen === 'number' && candidates[c.chosen] ? c.chosen : 0
      critique = { scores: c.scores ?? [], chosen: idx }
      story = normalizeStory(c.final) ?? candidates[idx]!
    } catch (err) {
      console.warn(`[video-story] critic attempt ${attempt + 1} failed`, err instanceof Error ? err.message : err)
    }
  }

  story = {
    ...story,
    shots: story.shots.map(s => ({ ...s, prompt: finalizeVideoPrompt(s.prompt, opts.companyName) })),
  }
  story.timeline = buildTimeline(story)

  return {
    story,
    candidates,
    critique,
    ideas: Array.isArray(w.ideas) ? w.ideas.map(String).slice(0, 12) : [],
    costUsd: await calculateCost(model, inputTokens, outputTokens),
    inputTokens,
    outputTokens,
    model,
  }
}

function normalizeStory(raw: unknown): VideoStory | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const beats = (Array.isArray(r.beats) ? r.beats : [])
    .map(b => b as Record<string, unknown>)
    .map(b => ({ role: String(b.role) as StoryBeat['role'], line: clean(b.line), visual: String(b.visual ?? '').trim() }))
    .filter(b => ['hook', 'turn', 'payoff'].includes(b.role) && b.line)
  let shots = (Array.isArray(r.shots) ? r.shots : [])
    .map(s => s as Record<string, unknown>)
    .map(s => ({ prompt: String(s.prompt ?? '').trim(), seconds: (Number(s.seconds) === 10 ? 10 : 5) as 5 | 10 }))
    .filter(s => s.prompt.length >= 60)
  const mode: VideoStory['mode'] = r.mode === 'multi' || shots.length > 1 ? 'multi' : 'single'
  if (mode === 'single') shots = shots.slice(0, 1).map(s => ({ ...s, seconds: 10 }))
  else shots = shots.slice(0, 3).map(s => ({ ...s, seconds: 5 }))
  if (beats.length < 3 || !shots.length) return null
  return {
    look: String(r.look ?? '').trim(),
    idea: String(r.idea ?? '').trim(),
    takeaway: String(r.takeaway ?? '').trim(),
    beats,
    end_card: clean(r.end_card),
    mode,
    shots,
    timeline: [],
  }
}

/** Overlay timing over the joined video: three beats, the end card over the last ~1.6s. */
export function buildTimeline(story: VideoStory): VideoStory['timeline'] {
  const total = story.shots.reduce((n, s) => n + s.seconds, 0)
  const endCardAt = Math.max(total - 1.6, total * 0.84)
  const byRole = (role: StoryBeat['role']) => story.beats.find(b => b.role === role)?.line ?? ''
  if (story.mode === 'multi' && story.shots.length === 3) {
    return [
      { start: 0, end: 5, text: byRole('hook') },
      { start: 5, end: 10, text: byRole('turn') },
      { start: 10, end: endCardAt, text: byRole('payoff') },
      { start: endCardAt, end: total + 0.1, text: story.end_card },
    ]
  }
  const third = total / 3
  return [
    { start: 0, end: third, text: byRole('hook') },
    { start: third, end: third * 2, text: byRole('turn') },
    { start: third * 2, end: endCardAt, text: byRole('payoff') },
    { start: endCardAt, end: total + 0.1, text: story.end_card },
  ]
}

function clean(v: unknown): string {
  return String(v ?? '').trim().replace(/^["“]|["”]$/g, '')
}

function parseJson<T>(raw: string, label: string): T {
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) throw new Error(`Video ${label} did not return JSON: ${raw.slice(0, 300)}`)
  return JSON.parse(m[0]) as T
}
