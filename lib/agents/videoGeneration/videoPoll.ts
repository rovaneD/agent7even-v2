import { pollVideoJob, type VideoJobPollResult } from './openRouterVideo'

export type VideoPollPhase = 'rendering' | 'editing' | 'completed' | 'failed'

/**
 * What one status response means for a video that is already filming or cutting.
 * A dropped request, a non-OK response, or a body with no status is not a finished
 * video. The panel has to ask again. Otherwise one provider blip — or the edit
 * request dying at the function time limit — ends the only poll, and a charged
 * video never reaches Approvals and is never refunded.
 * Any other status (review, unknown) stops, matching the panels' previous behavior.
 */
export function videoPollAdvance(
  current: 'rendering' | 'editing',
  result: { httpOk: boolean; status?: string | null },
): { status: VideoPollPhase; keepPolling: boolean } {
  if (!result.httpOk || result.status == null || result.status === '') {
    return { status: current, keepPolling: true }
  }
  if (result.status === 'completed' || result.status === 'failed') {
    return { status: result.status, keepPolling: false }
  }
  if (result.status === 'rendering' || result.status === 'editing') {
    return { status: result.status, keepPolling: true }
  }
  return { status: current, keepPolling: false }
}

/** A status read that throws is not a failed render. The next poll can still finish the job. */
export async function pollVideoJobSafely(id: string): Promise<VideoJobPollResult | null> {
  try {
    return await pollVideoJob(id)
  } catch (err) {
    console.error('[video] status poll failed', id, err instanceof Error ? err.message : err)
    return null
  }
}
