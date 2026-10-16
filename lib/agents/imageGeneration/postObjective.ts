/**
 * "Post goal" on the single-post form is a dropdown objective (Awareness, Leads, …).
 * It steers strategy only — it is never on-image copy. Before this module, briefs quoted
 * the objective as the headline, producing images that read "AWARENESS: …".
 */
export const POST_GOAL_OBJECTIVES = [
  'awareness',
  'engagement',
  'traffic',
  'leads',
  'sales',
  'community',
] as const

const OBJECTIVE_ANGLE: Record<string, string> = {
  awareness: 'names the problem the product solves, for people who have not heard of it yet',
  engagement: 'asks a pointed question or makes a claim the audience will want to react to',
  traffic: 'promises a specific payoff worth clicking through for',
  leads: 'names the customer pain and the result they want instead',
  sales: 'states the concrete outcome the customer gets by buying',
  community: 'speaks to an experience the audience shares',
}

const OBJECTIVE_ALT = POST_GOAL_OBJECTIVES.join('|')
const OBJECTIVE_PREFIX_RE = new RegExp(`^\\s*(?:${OBJECTIVE_ALT})\\s*[:\\-–—|]+\\s*`, 'i')

function norm(text: string): string {
  return text.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** True when the text is just an objective label, e.g. "Awareness", "AWARENESS:". */
export function isPostGoalObjective(text: string | null | undefined): boolean {
  if (!text) return false
  return (POST_GOAL_OBJECTIVES as readonly string[]).includes(norm(text))
}

/** True when a headline opens with an objective label, e.g. "AWARENESS: Stop guessing". */
export function hasObjectivePrefix(text: string | null | undefined): boolean {
  return !!text && OBJECTIVE_PREFIX_RE.test(text)
}

/** "AWARENESS: Stop guessing" → "Stop guessing". Leaves other text untouched. */
export function stripObjectivePrefix(text: string): string {
  return text.replace(OBJECTIVE_PREFIX_RE, '').trim()
}

/** What the headline should do for this objective; null for free-text goals. */
export function objectiveAngle(goal: string | null | undefined): string | null {
  if (!goal) return null
  return OBJECTIVE_ANGLE[norm(goal)] ?? null
}
