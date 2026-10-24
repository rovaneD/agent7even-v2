import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { openRouterComplete } from '@/lib/agents/openrouter'
import { briefComposeModel } from '@/lib/agents/imageGeneration/briefCompose'
import {
  formatCreativeDirectionBlock,
  getOrComputeCreativeDirection,
} from '@/lib/agents/foundationCreativeDirection'
import { videoTypeById, type VideoTypeSpec } from '@/lib/agents/contentPosting/videoTypes'

export const maxDuration = 60

/**
 * Plan step for the Video Post create panel. Free: one text call, no render, no credits.
 * Returns the script / shot list the user reviews (and can edit) before anything is generated.
 */

type Body = {
  typeId?: string
  inputs?: Record<string, string | string[]>
  length?: number
}

export type VideoPlanBeat = { text: string; visual: string }
export type VideoPlan = {
  title: string
  beats: VideoPlanBeat[]
  endCard: string
  caption: string
  notes: string[]
  /** Cinematic B-roll: where the on-camera lines are filmed, and each B-roll shot in order. */
  onCamera?: string
  scenes?: string[]
}

const WORDS_PER_SECOND = 2.6

/**
 * Writing rules from the ugc-saas-review-video skill (teach, don't pitch; talk like people talk).
 * Owner review 2026-10-24: scripts still read rigid and AI-written ("If you…, try this." + "step one,
 * step two" every time). Now: sounds like one real person thinking out loud, not a template.
 */
const PRESENTER_SCRIPT_RULES = (words: number) =>
  [
    `About ${words} spoken words in total, 4–5 beats. Each beat = one spoken line.`,
    'Write it the way one real person actually talks to a friend on camera, not the way an ad or a blog post reads.',
    'Open in the middle of a thought: a small admission, a reaction or something that just happened ("Okay so I used to…", "Someone asked me this yesterday…", "Honestly I didn\'t get this until…"). Don\'t always open with "If you…".',
    'Give the useful part as what you actually do, with one or two concrete everyday details (a day, a time, an object, a real customer question), not a numbered list. Avoid "step one / step two" unless the topic truly is steps.',
    'Mix long run-on lines joined with "and" / "so" with short fragments. Contractions always. At most one light filler ("like", "honestly", "okay so"). No CAPS, no em dashes, no slogans, no rhetorical questions to the viewer, no tidy rule-of-three in every line.',
    'End on a plain, sincere line that sounds said, not written. Never a price or a hard sell. Claims only from the business\'s own facts; no invented results.',
    'Before answering, reread every line out loud in your head: if a line sounds like marketing copy or like ChatGPT, rewrite it.',
  ].join('\n')

function typeBrief(t: VideoTypeSpec, inputs: Record<string, string | string[]>, seconds: number): string {
  const words = Math.round(seconds * WORDS_PER_SECOND)
  const v = (k: string) => {
    const x = inputs[k]
    return Array.isArray(x) ? x.join(', ') : (x ?? '').trim()
  }
  switch (t.id) {
    case 'presenter_tip':
      return [
        `A ${seconds}s vertical video. One creator talks to camera as the business's presenter, never as a customer and never claiming to be the owner.`,
        `Tip topic: ${v('topic')}`,
        PRESENTER_SCRIPT_RULES(words),
        'There are no cut-in cards for this video type: every beat\'s visual is "presenter". No end card: endCard = "". The last line is the ending.',
      ].join('\n')
    case 'cinematic_broll': {
      const lineCount = seconds >= 30 ? 5 : 4
      const moments = seconds >= 30 && v('oncam') === '2' ? 2 : seconds >= 30 ? 3 : 2
      const camIdx = moments === 3 ? [0, 2, 4] : [0, lineCount - 1]
      const shots = seconds >= 30 ? 4 : 2
      const pattern = Array.from({ length: lineCount }, (_, i) => (camIdx.includes(i) ? 'on camera' : 'B-roll')).join(', ')
      return [
        `A ${seconds}s vertical cinematic video. One creator talks to camera on some lines; on the others we hear their voice over B-roll of them in other places. They speak as the business's presenter, never as a customer and never claiming to be the owner.`,
        `Topic: ${v('topic')}`,
        PRESENTER_SCRIPT_RULES(words),
        `Exactly ${lineCount} beats, in this order: ${pattern}. visual = "on camera" or "B-roll" to match.`,
        'B-roll lines should be the ones that describe doing something, so the shots can show it.',
        `Also return "onCamera": where the on-camera lines are filmed (one short place description, cinematic and real, e.g. "leaning on a high-rise balcony railing, city and hills behind").`,
        `And "scenes": exactly ${shots} B-roll shots in the order they appear, each "place: one simple action" that fits the line it covers (e.g. "a café window seat: writing a short list in a notebook, a coffee beside it"). Simple actions only; nothing passed from hand to hand. Mix indoor and outdoor places that belong to the same day and the same person. The creator never looks at the camera in B-roll.`,
        v('settings') ? `The owner wants it filmed here, use these places: ${v('settings')}` : 'Pick the places yourself: real, cinematic, and right for this business.',
        'No end card: endCard = "".',
      ].join('\n')
    }
    case 'product_showcase':
      return [
        `A ${seconds}s vertical video. One creator walks through the business's own product or page, speaking as the business's presenter, never as a customer.`,
        `Page: ${v('url')}`,
        `Takeaway: ${v('angle')}`,
        PRESENTER_SCRIPT_RULES(words),
        'visual = which real screen of that page shows as a card on that line (e.g. "screen: pricing section"), or "presenter". No card on the first or last line. No end card: endCard = "". The last line is the ending.',
      ].join('\n')
    case 'editorial_explainer':
      return [
        `A ${seconds}s faceless vertical explainer in exactly 3 scenes, style: ${v('style') || 'Cutouts & labels'}.`,
        `Topic: ${v('topic')}`,
        `Narration about ${words} words. Each beat = one scene: text = narration, visual = what the scene shows in that style (real objects of this trade, no people talking).`,
      ].join('\n')
    case 'animated_post':
      return [
        `A ${seconds}s vertical motion version of the business's approved image post: "${v('post')}".`,
        'No narration. 2 beats: text = on-screen headline timing note, visual = the camera move / motion on the post image. Keep the post\'s design; only motion is added.',
      ].join('\n')
    case 'brandkit':
      return [
        `A ${seconds}s editorial brand reveal using the business's REAL logo and colors (supplied from its Brand Kit, never redrawn).`,
        `Objects in order: ${v('objects')}`,
        `No narration. One beat per object: text = short on-screen word or empty, visual = how that object is shot (surface, light, motion). End card line: ${v('line') || '(write one short line)'}.`,
      ].join('\n')
    default:
      return ''
  }
}

function parsePlan(raw: string | null | undefined): VideoPlan | null {
  if (!raw) return null
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const j = JSON.parse(m[0]) as Partial<VideoPlan>
    const beats = (j.beats ?? [])
      .filter(b => b && typeof b.text === 'string')
      .map(b => ({ text: String(b.text).trim(), visual: String(b.visual ?? '').trim() }))
    if (!beats.length) return null
    return {
      title: String(j.title ?? '').trim(),
      beats,
      endCard: String(j.endCard ?? '').trim(),
      caption: String(j.caption ?? '').trim(),
      ...(typeof (j as { onCamera?: unknown }).onCamera === 'string' ? { onCamera: String((j as { onCamera: string }).onCamera).trim() } : {}),
      ...(Array.isArray((j as { scenes?: unknown }).scenes) ? { scenes: ((j as { scenes: unknown[] }).scenes).map(x => String(x).trim()).filter(Boolean).slice(0, 6) } : {}),
      notes: Array.isArray(j.notes) ? j.notes.map(String).slice(0, 4) : [],
    }
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    body = {}
  }

  const type = videoTypeById(body.typeId)
  if (!type) return NextResponse.json({ error: 'unknown_type' }, { status: 400 })
  const inputs = body.inputs ?? {}
  const seconds = type.lengths.includes(Number(body.length)) ? Number(body.length) : type.defaultLength

  for (const f of type.fields) {
    if ('required' in f && f.required) {
      const val = inputs[f.key]
      if (!(typeof val === 'string' ? val.trim() : val?.length)) {
        return NextResponse.json({ error: 'missing_input', field: f.key, message: `Add "${f.label}" first.` }, { status: 422 })
      }
    }
  }

  // Shorts maker can't be planned until the source video is transcribed.
  if (type.id === 'shorts_maker') {
    const plan: VideoPlan = {
      title: `${inputs.count ?? '3'} shorts from your video`,
      beats: [
        { text: 'Maya transcribes your video word by word.', visual: 'source video' },
        { text: `Picks the ${inputs.count ?? '3'} strongest moments, each with a hook in the first line.`, visual: 'moments list' },
        { text: 'Reframes each to vertical and adds captions.', visual: 'vertical cut' },
      ],
      endCard: '',
      caption: '',
      notes: ['You see the picked moments before any short is cut.'],
    }
    return NextResponse.json({ plan, seconds, priceCredits: null })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'openrouter_not_configured' }, { status: 503 })
  }

  const { workspaceId, profile } = ws
  const companyName = (profile.company_name as string | null) ?? 'the business'
  let directionBlock = ''
  try {
    const dir = await getOrComputeCreativeDirection({ profileId: workspaceId, companyName })
    directionBlock = formatCreativeDirectionBlock(dir, companyName)
  } catch {
    directionBlock = `Business: ${companyName}`
  }

  const system = [
    'You plan short social videos for small businesses. Output JSON only.',
    'Rules: plain spoken English; no invented numbers, prices, awards, reviews or customer quotes; no "game-changer", "unlock", "elevate"; never speak as a customer or give a testimonial; never mention AI.',
    'JSON shape: {"title": string, "beats": [{"text": string, "visual": string}], "endCard": string, "caption": string, "notes": string[]}',
    'caption = the social post caption that goes with the video (not the spoken script): 1-3 short plain sentences that make someone want to watch or save it, in the business\'s voice, then a blank line and at most 3 relevant hashtags. Under 400 characters. No em dashes, no emojis unless the brand uses them, no CAPS.',
    'endCard = short closing line for the brand end card (logo shown with it). notes = at most 2 short things the owner should check (e.g. a claim to confirm).',
  ].join('\n')

  const user = [`## Business\n${directionBlock}`, `## Video: ${type.name}\n${typeBrief(type, inputs, seconds)}`].join('\n\n')

  try {
    const ask = () =>
      openRouterComplete({
        model: briefComposeModel(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 3000,
        temperature: 0.6,
      })
    const out = await ask()
    let plan = parsePlan(out.content)
    // One retry: an empty or non-JSON reply happens now and then (2026-10-24: null content crashed the route).
    if (!plan) {
      console.warn('[video-plan] unparseable reply, retrying', type.id, String(out.content ?? '').slice(0, 200))
      plan = parsePlan((await ask().catch(() => null))?.content)
    }
    if (!plan) return NextResponse.json({ error: 'plan_failed', message: 'Maya could not write a plan. Try again.' }, { status: 502 })

    // Spoken types must fit the length: models overshoot word counts, so tighten once if needed.
    // (Approve & create refuses scripts over 3.2 words/second.)
    const budget = Math.round(seconds * WORDS_PER_SECOND)
    const spoken = type.presenter || type.id === 'editorial_explainer'
    if (type.id === 'cinematic_broll') {
      const shots = seconds >= 30 ? 4 : 2
      if ((plan.scenes?.length ?? 0) < shots || !plan.onCamera) {
        return NextResponse.json({ error: 'plan_failed', message: 'Maya could not plan the shots. Try again.' }, { status: 502 })
      }
      plan.scenes = plan.scenes!.slice(0, shots)
    }
    const countWords = (p: VideoPlan) => p.beats.map(b => b.text).join(' ').split(/\s+/).filter(Boolean).length
    if (spoken && countWords(plan) > budget * 1.15) {
      const tighter = await openRouterComplete({
        model: briefComposeModel(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
          { role: 'assistant', content: JSON.stringify(plan) },
          {
            role: 'user',
            content: `That is ${countWords(plan)} spoken words; the limit is ${budget} for ${seconds} seconds. Rewrite the beats to ${budget} words or fewer in total. Keep the hook, the steps and the natural spoken style; cut words, not meaning. Same JSON shape.`,
          },
        ],
        max_tokens: 3000,
        temperature: 0.4,
      }).catch(() => null)
      const shorter = tighter ? parsePlan(tighter.content) : null
      if (shorter && countWords(shorter) < countWords(plan)) plan = { ...shorter, onCamera: shorter.onCamera || plan.onCamera, scenes: shorter.scenes?.length === plan.scenes?.length ? shorter.scenes : plan.scenes }
    }

    return NextResponse.json({ plan, seconds, words: countWords(plan), wordBudget: budget })
  } catch (err) {
    console.error('[video-plan]', err)
    return NextResponse.json({ error: 'plan_failed', message: 'Maya could not write a plan. Try again.' }, { status: 502 })
  }
}
