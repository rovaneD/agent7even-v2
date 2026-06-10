/**
 * Maya page-context payload contract (Phases 1–3 pages implement this shape).
 *
 * Rules:
 * - Summaries only: put compact labeled lines in `metrics`. Never raw chart
 *   arrays, heatmap matrices, or full API responses.
 * - `dataSource` is mandatory — serialized as the first line Maya sees.
 * - `sample`: page shows demo/mock numbers; Maya must not present them as real.
 * - `live`: connected sources with fetched data the user is viewing.
 * - `none`: no sources connected yet (distinct from zero traffic on a live source).
 * - Keep `metrics` token-cheap (~15–25 lines max per page).
 *
 * activeView (Phase 4 — optional sub-page state):
 * - Describes the ONE sub-surface the user is currently looking at — not an
 *   inventory of all tabs. Page-level `metrics` stay as background context.
 * - Prefer the object form `{ label, state? }` for tabbed pages; serialized as
 *   `CURRENTLY VIEWING: <label> — <state>` above the on-screen summary.
 * - Legacy string form is still accepted (Phases 1–3) and serializes as
 *   `Active view: <string>` — unchanged until those pages migrate in Phase 5.
 * - If the active sub-surface shows sample/mock data, say so in `state`.
 */

export type MayaDataSource = 'live' | 'sample' | 'none'

/** Sub-page / tab the user is focused on (Phase 4+). */
export interface MayaActiveView {
  /** Human name of the current tab or sub-surface, e.g. "Voice" */
  label: string
  /** Compact state of THAT sub-surface only, e.g. "Brand Voice Guide: not yet generated" */
  state?: string
}

export interface MayaPageContext {
  /** Page identifier, e.g. "ANALYTICS PAGE" */
  page: string
  dataSource: MayaDataSource
  company?: string
  /** Sub-view: object (Phase 4+) foregrounds CURRENTLY VIEWING; string (legacy) unchanged */
  activeView?: string | MayaActiveView
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

  if (typeof payload.activeView === 'string') {
    lines.push(`Active view: ${payload.activeView}`)
  }

  if (payload.connections?.length) {
    lines.push('Connections:')
    for (const c of payload.connections) lines.push(`- ${c}`)
  }

  if (payload.activeView && typeof payload.activeView !== 'string') {
    const { label, state } = payload.activeView
    lines.push(
      state
        ? `CURRENTLY VIEWING: ${label} — ${state}`
        : `CURRENTLY VIEWING: ${label}`,
    )
  }

  if (payload.metrics?.length) {
    lines.push('On-screen summary:')
    for (const m of payload.metrics) lines.push(`- ${m}`)
  }

  if (payload.affordance) lines.push(payload.affordance)

  return lines.join('\n')
}
