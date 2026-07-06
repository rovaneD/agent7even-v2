import type { FoundationChangelogEntry } from '@/lib/foundation/changelogContext'

const DEV_PROBE_PATTERN = /no user_id probe/i

/** Owner-visible observations for Foundation Memory tab — not raw Observer internals. */
export function formatChangelogObservationsForHub(
  entries: FoundationChangelogEntry[],
  limit = 12,
): Array<{
  signalType: FoundationChangelogEntry['signal_type']
  summary: string
  createdAt: string
  agentId: string | null
}> {
  return entries
    .filter(entry => entry.content_summary?.trim() && !DEV_PROBE_PATTERN.test(entry.content_summary))
    .slice(0, limit)
    .map(entry => ({
      signalType: entry.signal_type,
      summary: entry.content_summary.trim(),
      createdAt: entry.created_at,
      agentId: entry.agent_id,
    }))
}
