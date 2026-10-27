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

export const maxDuration = 120

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

// Voice runs ~1.15x (presenterVoice TEMPO), so a little more script fits each second.
const WORDS_PER_SECOND = 2.9

/**
 * Script rules for presenter videos. History (owner, 2026-10-24/26): "rigid and AI-written", then
 * "the script sucks", then "still sounds like AI slop, non human". The fix that worked was the
 * owner's own rewrite of a script: same advice, but said the way a person talks. The before/after
 * pair below is the reference for tone, and the rules are what changed between them.
 */
const TONE_EXAMPLE = [
  'TONE REFERENCE (owner-approved). Use it only to hear the difference; never reuse its words, topic or structure.',
  'Sounds like AI (bad):',
  '"That one-star review is sitting there, and you\'re ignoring it or typing something angry." / "We reply to every review. Thank them by name, apologize for the one thing that went wrong, offer a fix." / "Say the order came late. I\'d write: Thanks, Dana. Sorry about the wait. Email us and we\'ll fix it." / "Read it out loud once, cut any excuse, then post it." / "Anyone reading later sees a calm answer under the bad review, and that\'s what sticks."',
  'Sounds like a person (good):',
  '"You get a one-star review, and you want to explain everything they left out. Give yourself a minute before you reply." / "We answer every review, but we keep it pretty short. Thank them, say sorry for what went wrong, and tell them how we can help." / "If their order was late, I\'d say, \'Thanks for letting us know, Dana. Sorry your order took so long. Email us your order number so we can sort it out.\'" / "Then read it back. If you\'re still arguing with them in the reply, take that part out." / "Other customers are going to read that too. You want them to see that you\'ll help when something goes wrong."',
].join('\n')

const PRESENTER_SCRIPT_RULES = (words: number) =>
  [
    `About ${words} spoken words in total. Each beat = one spoken line.`,
    'Shape: (1) name a feeling or urge the viewer has in that moment, then the first bit of advice; (2) one specific thing they can copy, shown with a real example; (3) the plain reason it matters.',
    'How a person actually says it (this matters more than anything else):',
    '- Full, easy sentences joined the way people join them: "and", "but", "so", "then", "if… then…", "so we can". Never strings of clipped commands like "Read it, cut it, post it."',
    '- Name the feeling or urge, not just the situation ("you want to explain everything they left out").',
    '- Soft, ordinary words and small hedges people use: "pretty short", "a minute", "sort it out", "going to". Plain words over punchy ones.',
    '- Advice as "if this, do that" from experience, not as orders.',
    '- When the script quotes something the viewer could say or write, make it sound like polite speech in full sentences, introduced with "I\'d say," never "I\'d write:".',
    '- End with the plain reason it matters, said simply. No moral, slogan or punchline.',
    '- Contractions, no CAPS, no em dashes. Do not open with "Okay so", "So I just", "Hey guys" or "If you".',
    'Never write: aphorisms or quote-card lines ("X isn\'t for Y, it\'s for Z", "and that\'s what sticks"), lists of three clipped verbs, ad or LinkedIn copy, rhetorical questions.',
    'Who is talking: the business\'s presenter. "We" for what the business does, "I" only for what they\'d personally say or think. Never "my shop", "my customers".',
    'Claims only from the business\'s own facts; no invented results, numbers, reviews or customer quotes. Never a price or a hard sell.',
    TONE_EXAMPLE,
  ].join('\n')

/** Second pass: a script editor reads every line out loud (in its head) and rewrites anything that sounds written. */
const SCRIPT_EDITOR = (words: number) =>
  [
    'You are a script editor for short creator videos. Your only job: make every line sound like a real person talking, not AI or ad copy. Read each line out loud in your head.',
    '- Clipped command lists ("Thank them, apologize, offer a fix.") → turn into a normal sentence with "and"/"so"/"then".',
    '- Punchy, quotable or slogan-like lines → say it plainly, the way a friend would.',
    '- Anything the viewer is told to say or write → polite full sentences, introduced with "I\'d say,".',
    '- Advice → "if this happens, do that", from experience.',
    '- Line 1 should name what the viewer feels or wants to do in that moment.',
    '- Last line: the plain reason it matters. No moral.',
    '- Keep the facts. Presenter voice: "we" for the business, "I" only for their own words or thoughts.',
    `- About ${words} words in total; keep the same number of beats in the same order, and keep B-roll lines about doing something.`,
    TONE_EXAMPLE,
    'Return valid JSON only: {"beats": [{"text": string}]} with the improved lines. Quote speech inside a line with single quotes, never double quotes.',
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
    'Valid JSON only: inside any string, quote speech with single quotes (\'like this\'), never double quotes.',
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
      // Usually unescaped double quotes around quoted speech inside a line: ask again, stricter.
      const again = await openRouterComplete({
        model: briefComposeModel(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
          { role: 'assistant', content: String(out.content ?? '') },
          { role: 'user', content: 'That was not valid JSON. Send the same plan again as valid JSON only. Inside strings use single quotes for quoted speech, never double quotes.' },
        ],
        max_tokens: 3000,
        temperature: 0.3,
      }).catch(() => null)
      plan = parsePlan(again?.content)
    }
    if (!plan) return NextResponse.json({ error: 'plan_failed', message: 'Maya could not write a plan. Try again.' }, { status: 502 })

    // Spoken types must fit the length: models overshoot word counts, so tighten once if needed.
    // (Approve & create refuses scripts over 3.5 words/second.)
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
    if (type.presenter) {
      const edited = await openRouterComplete({
        model: briefComposeModel(),
        messages: [
          { role: 'system', content: SCRIPT_EDITOR(budget) },
          { role: 'user', content: `## Brief\n${user}\n\n## Draft\n${JSON.stringify({ beats: plan.beats.map(b => ({ text: b.text })) })}` },
        ],
        max_tokens: 2000,
        temperature: 0.5,
      }).catch(() => null)
      const m = edited?.content?.match(/\{[\s\S]*\}/)
      try {
        const j = m ? (JSON.parse(m[0]) as { beats?: Array<{ text?: unknown }> }) : null
        const texts = (j?.beats ?? []).map(b => String(b.text ?? '').trim())
        if (texts.length === plan.beats.length && texts.every(Boolean)) {
          plan = { ...plan, beats: plan.beats.map((b, i) => ({ ...b, text: texts[i]! })) }
        }
      } catch {
        // keep the draft
      }
    }
    if (spoken && countWords(plan) > budget * 1.05) {
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
