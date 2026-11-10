// Server-only. Client panels must import videoPollAdvance.ts instead — this file
// pulls in the provider client and the image compressor, which break the browser build.
import { pollVideoJob, type VideoJobPollResult } from './openRouterVideo'

/** A status read that throws is not a failed render. The next poll can still finish the job. */
export async function pollVideoJobSafely(id: string): Promise<VideoJobPollResult | null> {
  try {
    return await pollVideoJob(id)
  } catch (err) {
    console.error('[video] status poll failed', id, err instanceof Error ? err.message : err)
    return null
  }
}
