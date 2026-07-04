import { z } from 'zod'

const snapshotText = z.string().trim().max(2000)
const snapshotShortText = z.string().trim().max(240)
const snapshotList = z.array(snapshotShortText).max(10)

export const SiteSnapshotSchema = z.object({
  businessOverview: snapshotText,
  marketPositioning: z.object({
    primary: snapshotText,
    secondary: snapshotText.optional(),
    tertiary: snapshotText.optional(),
  }),
  competitors: z.object({
    local: snapshotList.optional(),
    international: snapshotList.optional(),
  }),
  competitiveAdvantages: snapshotList,
  customerSegments: z.array(
    z.object({
      label: snapshotShortText,
      shareHint: snapshotShortText.optional(),
      description: snapshotText,
    }),
  ).max(10),
  fetchedAt: z.string().trim().max(64),
  sourceUrl: z.string().trim().url().max(2048),
})

export type SiteSnapshot = z.infer<typeof SiteSnapshotSchema>

export function parseSiteSnapshot(raw: unknown): SiteSnapshot | null {
  const parsed = SiteSnapshotSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function formatSiteSnapshotForAgent(snapshot: SiteSnapshot): string {
  const lines: string[] = [
    '## Website Strategic Snapshot (user-reviewed enrichment — does not replace Phase 1)',
    `Source: ${snapshot.sourceUrl} · captured ${snapshot.fetchedAt}`,
    '',
    '### Business Overview',
    snapshot.businessOverview,
    '',
    '### Market Positioning',
    `- Primary: ${snapshot.marketPositioning.primary}`,
  ]

  if (snapshot.marketPositioning.secondary) {
    lines.push(`- Secondary: ${snapshot.marketPositioning.secondary}`)
  }
  if (snapshot.marketPositioning.tertiary) {
    lines.push(`- Tertiary: ${snapshot.marketPositioning.tertiary}`)
  }

  const local = snapshot.competitors.local?.filter(Boolean) ?? []
  const intl = snapshot.competitors.international?.filter(Boolean) ?? []
  if (local.length || intl.length) {
    lines.push('', '### Competitors')
    if (local.length) lines.push(`- Local: ${local.join(', ')}`)
    if (intl.length) lines.push(`- International: ${intl.join(', ')}`)
  }

  if (snapshot.competitiveAdvantages.length) {
    lines.push('', '### Competitive Advantages')
    for (const item of snapshot.competitiveAdvantages) {
      lines.push(`- ${item}`)
    }
  }

  if (snapshot.customerSegments.length) {
    lines.push('', '### Customer Segments')
    for (const seg of snapshot.customerSegments) {
      const hint = seg.shareHint ? ` (${seg.shareHint})` : ''
      lines.push(`- **${seg.label}${hint}:** ${seg.description}`)
    }
  }

  return lines.join('\n')
}
