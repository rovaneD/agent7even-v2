import type { IdeaAnalysis } from '@/lib/agents/ideaAnalysis'

export const VIRAL_HOOKS_FRAMEWORK = `VIRAL HOOKS SERVICE FRAMEWORK
Use this request to craft hook ideas, not a generic content plan.

Goal:
- Create short-form content hooks that can open Reels, TikToks, YouTube Shorts, carousels, captions, or emails.
- Use the customer's business, offer, audience, pain points, desired result, and Foundation/Brand Kit context when available.
- If the customer gives limited detail, make reasonable assumptions and produce usable hooks anyway.

Hook families to use:
1. Cost-Narration Hooks
- "It took me [x] years to master [a skill], but I'm going to teach you the [x] most powerful lessons in the next [x] seconds."
- "I spent [$] on [goal], so you don't have to. Here's what was worth it and definitely not worth it."
- "It took me [x] years to learn this but I'll teach it to you in less than 1 minute."
- "After over [x] years [doing action], here's what I wish someone would've told me from day one."
- "I spent [x] hours researching and testing every [tool]. Here are the only [x] you actually need."

2. False-Statement Hooks
- "The number 1 weakness of [tool] is that it can't [do action]... just kidding, of course it can."
- "If you don't [do action] then you will never [get dream result]. And that statement is completely wrong."
- "[Thing] is not a good [option] for [situation]. It's the best for [situation]."
- "[Controversial thing] is the biggest scam ever pulled on us... or is it?"
- "Never [do action]... unless you want to [get desirable result]."

3. Comparison Hooks
- "The only difference between [negative] and [positive] is [thing]."
- "This is how [thing] used to work. This is how it works today."
- "Do you want [popular desire] or do you want [deeper desire]?"
- "This is [common option] vs [new option]."
- "Do you want to be [common label] or do you want to be [desirable label]?"

4. Callout Hooks
- "If you can't [achieve result], it's not because you're not [positive trait], it's because you don't know how to [action]."
- "Your [common excuse] isn't the problem, [actual reason] is."
- "Everybody tells you to [do action] but nobody shows you how to do it, so let's [do action] together, step by step."
- "If you want [results] for free, with literally 0 extra effort, here's what you need to do."
- "So you wanna [achieve outcome] but hate [required painful action]."

5. Bold Statement Hooks
- "[Desirable outcome] for dummies."
- "There are only [x] different [things] you need to [action] to [achieve goal]."
- "Everyone tells you to [common advice] but nobody tells you how, so here's how to [do action] in [x] easy steps."
- "If I had [x] days to [achieve goal], this is exactly what I would do."
- "I genuinely believe anybody can [accomplish goal] if you just learn [unique solution]."

Output expectation:
- Return at least 25 hooks, grouped by the 5 hook families.
- Replace all placeholders with specific language for this customer.
- For each hook, include suggested format: Reel, TikTok, Short, carousel, caption, or email.
- Include a short note on why the strongest 5 hooks should work.
- Avoid fake claims, guaranteed results, or unverifiable numbers unless the customer provided them.`

export const VIRAL_HOOKS_OUTPUT_MARKER = 'VIRAL HOOKS GENERATED OUTPUT'

export const VIRAL_HOOKS_PREFILL_STORAGE_KEY = 'agent7even:viralHooksPrefill'

export type ViralHooksFormValues = {
  topic: string
  audience: string
  goal: string
  format: string
  tone: string
  notes: string
}

export type ViralHooksDraftHints = {
  audience?: string
  tone?: string
  goal?: string
  format?: string
  platform?: string
}

const DEFAULT_VIRAL_HOOKS_GOAL = 'Drive interest'
const DEFAULT_VIRAL_HOOKS_TONE = 'Direct and useful'
const DEFAULT_VIRAL_HOOKS_FORMAT = 'Instagram Reel'

export function formatViralHooksBrief(values: ViralHooksFormValues): string {
  return [
    `Topic or offer: ${values.topic.trim()}`,
    values.audience.trim() ? `Target audience: ${values.audience.trim()}` : '',
    `Primary goal: ${values.goal}`,
    `Best format: ${values.format}`,
    `Tone: ${values.tone}`,
    values.notes.trim() ? `Extra context: ${values.notes.trim()}` : '',
  ].filter(Boolean).join('\n')
}

function mapPlatformFromSource(sourceRef: string, platformHint?: string): string {
  if (platformHint?.trim()) return platformHint.trim()
  const lower = sourceRef.toLowerCase()
  if (lower.includes('tiktok')) return 'TikTok'
  if (lower.includes('youtube') || lower.includes('short')) return 'YouTube Short'
  if (lower.includes('carousel')) return 'Carousel'
  if (lower.includes('email')) return 'Email'
  if (lower.includes('linkedin')) return 'Caption'
  return DEFAULT_VIRAL_HOOKS_FORMAT
}

/** Map idea_analysis → the six Viral Hooks generator fields (single source of truth). */
export function mapAnalysisToViralHooksForm(
  analysis: IdeaAnalysis,
  hints?: ViralHooksDraftHints,
): ViralHooksFormValues {
  const topic = analysis.topic || analysis.idea_seed
  const notesParts = [
    `Idea seed: ${analysis.idea_seed}`,
    `Unique angle: ${analysis.unique_angle}`,
    `Belief to challenge: ${analysis.belief_to_challenge}`,
    `Contrarian reality: ${analysis.contrarian_reality}`,
    ...analysis.supporting_evidence.map((entry, index) => `Direction ${index + 1}: ${entry}`),
    analysis.source_ref ? `Source: ${analysis.source_ref}` : '',
  ].filter(Boolean)

  return {
    topic,
    audience: hints?.audience?.trim() ?? '',
    goal: hints?.goal?.trim() || DEFAULT_VIRAL_HOOKS_GOAL,
    format: mapPlatformFromSource(analysis.source_ref, hints?.format ?? hints?.platform),
    tone: hints?.tone?.trim() || DEFAULT_VIRAL_HOOKS_TONE,
    notes: notesParts.join('\n\n'),
  }
}

export function buildViralHooksBrief(
  analysis: IdeaAnalysis,
  hints?: ViralHooksDraftHints,
): string {
  return formatViralHooksBrief(mapAnalysisToViralHooksForm(analysis, hints))
}

/** User-supplied sources get Wire 2 (pre-filled modal); trusted sources get Wire 1 (one-click). */
export function isUserSuppliedIdeaSource(sourceRef: string): boolean {
  const ref = sourceRef.trim().toLowerCase()
  return ref.startsWith('pasted_url:') || ref.startsWith('user_topic:')
}

export function storeViralHooksPrefill(values: ViralHooksFormValues) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(VIRAL_HOOKS_PREFILL_STORAGE_KEY, JSON.stringify(values))
}

export function readViralHooksPrefill(): ViralHooksFormValues | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(VIRAL_HOOKS_PREFILL_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ViralHooksFormValues>
    if (!parsed.topic?.trim()) return null
    return {
      topic: parsed.topic,
      audience: parsed.audience ?? '',
      goal: parsed.goal ?? DEFAULT_VIRAL_HOOKS_GOAL,
      format: parsed.format ?? DEFAULT_VIRAL_HOOKS_FORMAT,
      tone: parsed.tone ?? DEFAULT_VIRAL_HOOKS_TONE,
      notes: parsed.notes ?? '',
    }
  } catch {
    return null
  }
}

export function clearViralHooksPrefill() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(VIRAL_HOOKS_PREFILL_STORAGE_KEY)
}

export async function createViralHooksOrder(
  briefBody: string,
): Promise<{ ok: true; orderId: string; warning?: string } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_type: 'viral_hooks',
        title: 'Viral Hooks',
        brief: `${briefBody.trim()}\n\n${VIRAL_HOOKS_FRAMEWORK}`,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string }).error ?? 'Could not generate Viral Hooks.' }
    }
    const orderId = (data as { order?: { id?: string } }).order?.id
    if (!orderId) return { ok: false, error: 'Viral Hooks order was not returned.' }
    return {
      ok: true,
      orderId,
      warning: (data as { deliverableWarning?: string }).deliverableWarning,
    }
  } catch {
    return { ok: false, error: 'Could not generate Viral Hooks. Try again.' }
  }
}

export function displayServiceBrief(brief: string | null | undefined) {
  if (!brief) return ''
  return brief
    .split(`\n\n${VIRAL_HOOKS_OUTPUT_MARKER}`)[0]
    .split('\n\nVIRAL HOOKS SERVICE FRAMEWORK')[0]
    .trim()
}

export function extractViralHooksGeneratedOutput(brief: string | null | undefined) {
  if (!brief) return ''
  const marker = `\n\n${VIRAL_HOOKS_OUTPUT_MARKER}\n`
  const markerIndex = brief.indexOf(marker)
  if (markerIndex < 0) return ''
  return brief
    .slice(markerIndex + marker.length)
    .split('\n\nVIRAL HOOKS SERVICE FRAMEWORK')[0]
    .trim()
}
