/**
 * Presenter and B-roll starts run inside the request that charged the customer (maxDuration 300s).
 * A task still sitting on the voice step with no provider job after this is a dead request:
 * the process was killed and its catch block never refunded. Polling must fail it once, not spin.
 */
export const ABANDONED_VOICE_START_MS = 10 * 60 * 1000

export function voiceStartAbandoned(
  startedAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!startedAt) return false
  const t = Date.parse(startedAt)
  if (!Number.isFinite(t)) return false
  return now - t >= ABANDONED_VOICE_START_MS
}
