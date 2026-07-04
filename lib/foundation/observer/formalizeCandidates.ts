import type { FoundationChangelogRow, ObserverCandidate } from '@/lib/foundation/observer/types'

type ThemeRule = {
  theme: string
  patterns: RegExp[]
  buildStatement: (rows: FoundationChangelogRow[]) => string
  layerHint: string
}

const THEME_RULES: ThemeRule[] = [
  {
    theme: 'agency_framing_rejected',
    patterns: [/agency/i, /fire your agency/i, /marketing director/i],
    buildStatement: rows =>
      `User rejected ${rows.length} output(s) using agency-frustration or anti-agency framing.`,
    layerHint: 'Avoid leading with agency-bashing hooks; test operator-efficiency or outcome-led angles.',
  },
  {
    theme: 'cta_softening',
    patterns: [/changed CTA/i, /\bCTA\b/i, /learn more/i, /buy now/i, /get started/i],
    buildStatement: rows =>
      `User edited ${rows.length} output(s) to change or soften call-to-action language before approval.`,
    layerHint: 'Prefer educational CTAs (Learn more, Get started) over hard-sell CTAs in social and email.',
  },
  {
    theme: 'community_content_preferred',
    patterns: [/community-focused/i, /community/i],
    buildStatement: rows => {
      const approved = rows.filter(r => r.signal_type !== 'rejected').length
      const rejected = rows.length - approved
      if (rejected > 0 && approved > 0) {
        return `Mixed signals on community-focused content (${approved} approved/edited, ${rejected} rejected).`
      }
      if (approved > 0) {
        return `User approved or edited toward community-focused content ${approved} time(s).`
      }
      return `User rejected community-focused content ${rejected} time(s).`
    },
    layerHint: 'Weight community and local-connection angles in content when aligned with Phase 1.',
  },
  {
    theme: 'pricing_angle',
    patterns: [/pricing-focused/i, /pricing/i, /\$\d/],
    buildStatement: rows =>
      `User made ${rows.length} decision(s) involving pricing-focused messaging.`,
    layerHint: 'Treat pricing mentions carefully — match Phase 1 positioning on value vs discount.',
  },
  {
    theme: 'campaign_builder_pattern',
    patterns: [/Campaign Builder/i, /campaign/i],
    buildStatement: rows => {
      const rejects = rows.filter(r => r.signal_type === 'rejected').length
      if (rejects >= rows.length / 2) {
        return `User rejected ${rejects} of ${rows.length} recent Campaign Builder outputs.`
      }
      return `User approved ${rows.filter(r => r.signal_type === 'approved').length} Campaign Builder output(s) with minimal rejection.`
    },
    layerHint: 'Vary campaign primary hooks between runs; do not repeat rejected campaign themes.',
  },
]

function rowThemes(row: FoundationChangelogRow): string[] {
  const text = `${row.content_summary} ${row.agent_id ?? ''}`
  return THEME_RULES.filter(rule => rule.patterns.some(p => p.test(text))).map(r => r.theme)
}

function clusterKey(theme: string, rows: FoundationChangelogRow[]): string {
  const dominantSignal =
    rows.filter(r => r.signal_type === 'rejected').length >= rows.length / 2
      ? 'rejected'
      : rows[0]?.signal_type ?? 'mixed'
  return `${theme}:${dominantSignal}`
}

/**
 * Rule-based Observer formalization (v0).
 * Clusters changelog rows by theme + dominant signal type.
 */
export function formalizeCandidates(rows: FoundationChangelogRow[]): ObserverCandidate[] {
  if (rows.length === 0) return []

  const buckets = new Map<string, FoundationChangelogRow[]>()

  for (const row of rows) {
    const themes = rowThemes(row)
    const assigned = themes.length > 0 ? themes : ['general_pattern']
    for (const theme of assigned) {
      const key = `${theme}:${row.signal_type}`
      const list = buckets.get(key) ?? []
      list.push(row)
      buckets.set(key, list)
    }
  }

  // Merge buckets that share theme (different signal types) for richer clusters
  const byTheme = new Map<string, FoundationChangelogRow[]>()
  for (const [key, bucketRows] of buckets.entries()) {
    const theme = key.split(':')[0]
    const existing = byTheme.get(theme) ?? []
    const ids = new Set(existing.map(r => r.id))
    for (const row of bucketRows) {
      if (!ids.has(row.id)) {
        existing.push(row)
        ids.add(row.id)
      }
    }
    byTheme.set(theme, existing)
  }

  const candidates: ObserverCandidate[] = []

  for (const [theme, clusterRows] of byTheme.entries()) {
    if (clusterRows.length === 0) continue

    const rule = THEME_RULES.find(r => r.theme === theme)
    const sorted = [...clusterRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )

    if (theme === 'general_pattern' && sorted.length < 2) continue

    candidates.push({
      theme: clusterKey(theme, sorted),
      statement: rule
        ? rule.buildStatement(sorted)
        : `Observed pattern across ${sorted.length} recent decisions: ${sorted[0].content_summary}`,
      supporting_summaries: sorted.map(r => r.content_summary),
      suggested_layer_hint: rule?.layerHint ??
        'Use recent approval and rejection signals to vary output without contradicting Phase 1.',
      changelog_ids: sorted.map(r => r.id),
    })
  }

  // Dedupe overlapping candidates (same changelog ids)
  const seen = new Set<string>()
  return candidates.filter(c => {
    const sig = [...c.changelog_ids].sort().join(',')
    if (seen.has(sig)) return false
    seen.add(sig)
    return true
  })
}
