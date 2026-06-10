/**
 * Maya page-context payload contract (Phase 2 pages implement this shape).
 *
 * Rules:
 * - Summaries only: put compact labeled lines in `metrics`. Never raw chart
 *   arrays, heatmap matrices, or full API responses.
 * - `dataSource` is mandatory — serialized as the first line Maya sees.
 * - `sample`: page shows demo/mock numbers; Maya must not present them as real.
 * - `live`: connected sources with fetched data the user is viewing.
 * - `none`: no sources connected yet (distinct from zero traffic on a live source).
 * - Keep `metrics` token-cheap (~15–25 lines max per page).
 */

export type MayaDataSource = 'live' | 'sample' | 'none'

export interface MayaPageContext {
  /** Page identifier, e.g. "ANALYTICS PAGE" */
  page: string
  dataSource: MayaDataSource
  company?: string
  /** Tab, step, or sub-view the user is on */
  activeView?: string
  /** Connection-state lines — disconnected vs connected vs pending */
  connections?: string[]
  /** Compact on-screen metrics Maya can discuss */
  metrics?: string[]
  /** One-line hint about what the user can do here */
  affordance?: string
}

/** Leading line injected for every payload — do not duplicate in metrics. */
export const MAYA_DATA_SOURCE_LINE: Record<MayaDataSource, string> = {
  sample: 'DATA SOURCE: SAMPLE / MOCK — not the user\'s real performance.',
  live:   'DATA SOURCE: LIVE — reflects this user\'s account and on-screen data.',
  none:   'DATA SOURCE: NONE — no data loaded on this page yet.',
}

export function serializeMayaPageContext(payload: MayaPageContext): string {
  const lines: string[] = [
    MAYA_DATA_SOURCE_LINE[payload.dataSource],
    payload.page,
  ]

  if (payload.company) lines.push(`Company: ${payload.company}`)
  if (payload.activeView) lines.push(`Active view: ${payload.activeView}`)

  if (payload.connections?.length) {
    lines.push('Connections:')
    for (const c of payload.connections) lines.push(`- ${c}`)
  }

  if (payload.metrics?.length) {
    lines.push('On-screen summary:')
    for (const m of payload.metrics) lines.push(`- ${m}`)
  }

  if (payload.affordance) lines.push(payload.affordance)

  return lines.join('\n')
}
