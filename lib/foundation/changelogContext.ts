import { createServiceClient } from '@/lib/supabase/server'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'

export type FoundationChangelogEntry = {
  signal_type: 'approved' | 'rejected' | 'edited'
  agent_id: string | null
  content_summary: string
  created_at: string
}

const DEFAULT_LIMIT = 20

export async function loadFoundationChangelog(
  actorProfileId: string,
  limit = DEFAULT_LIMIT,
): Promise<FoundationChangelogEntry[]> {
  const supabase = createServiceClient()
  const profileId = await resolveWorkspaceProfileId(supabase, actorProfileId)

  const { data, error } = await supabase
    .from('foundation_changelog')
    .select('signal_type, agent_id, content_summary, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50))

  if (error) {
    if (error.message.includes('foundation_changelog')) return []
    console.error('[foundation-changelog] load failed:', error.message)
    return []
  }

  return (data ?? []) as FoundationChangelogEntry[]
}

function formatEntryWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/** Agent system-prompt block — recent decision signals + anti-repetition rules. */
export function formatFoundationObserverContextForAgents(
  entries: FoundationChangelogEntry[],
): string {
  if (entries.length === 0) return ''

  const rejected = entries.filter(e => e.signal_type === 'rejected')
  const approved = entries.filter(e => e.signal_type === 'approved')
  const edited = entries.filter(e => e.signal_type === 'edited')

  const lines = entries.slice(0, 12).map(entry => {
    const agent = entry.agent_id ? ` · ${entry.agent_id}` : ''
    return `- [${entry.signal_type}] ${formatEntryWhen(entry.created_at)}${agent}: ${entry.content_summary}`
  })

  const rejectedThemes =
    rejected.length > 0
      ? rejected
          .slice(0, 5)
          .map(e => e.content_summary)
          .join('; ')
      : null

  const preferredThemes =
    [...edited, ...approved]
      .slice(0, 5)
      .map(e => e.content_summary)
      .join('; ') || null

  return `## Foundation Observer — recent decision signals (v0.5)
These summarize what the user approved, rejected, or edited recently. Phase 1 Foundation is still the anchor; this block is how the business has actually behaved in the product.

Recent signals (newest first):
${lines.join('\n')}

INTELLIGENCE RULES — apply on every run:
- Do not repeat angles, headlines, or framings the user rejected. ${rejectedThemes ? `Avoid repeating themes like: ${rejectedThemes}` : 'No rejections logged yet — still vary angle vs prior approved campaigns.'}
- ${preferredThemes ? `Lean toward patterns they approved or edited toward: ${preferredThemes}` : 'No approval/edit patterns yet — use Foundation but avoid generic repetition.'}
- For campaigns: if the last plan used one primary hook (e.g. agency frustration, fair competition, operator relief), choose a **different** primary hook this run unless task input explicitly requests the same angle.
- State assumptions briefly; do not re-dump the entire Foundation overview when these signals already cover the direction.`
}

/** Maya sidebar chat — shorter block + conversational behavior. */
export function formatFoundationObserverContextForMaya(
  entries: FoundationChangelogEntry[],
): string {
  if (entries.length === 0) return ''

  const recent = entries.slice(0, 8)
  const rejectedCount = entries.filter(e => e.signal_type === 'rejected').length

  const lines = recent.map(
    e => `- ${e.signal_type}: ${e.content_summary}`,
  )

  return `
FOUNDATION OBSERVER (recent decisions — use this so you do not sound repetitive):
${lines.join('\n')}

MAYA BEHAVIOR WITH OBSERVER DATA:
- Do not open every reply by reciting Foundation frustration/positioning verbatim. Lead with what is new, what changed, or what you learned from their recent approvals/rejections.
- If filling agent setup forms, vary audience/angle when prior campaign outputs were rejected or duplicated the same hook.
- Foundation Phase 1 is background truth; Observer signals are how they have actually decided.${rejectedCount > 0 ? ` They have ${rejectedCount} recent rejection(s) — do not steer them back into the same framing.` : ''}`
}
