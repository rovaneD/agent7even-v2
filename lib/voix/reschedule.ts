/**
 * One reschedule call may create one follow-up.
 * `offered` means the team is waiting on the client. Anything else is already settled,
 * so a repeated tool call must not insert another appointment.
 */

/** Dashboard line when the client rejected the offered times and asked for another. */
export const RESCHEDULE_OTHER_TIME = 'Client asked for a different time. Confirm the new request.'

/** Dashboard line when the reschedule call ended and the offer is still open. */
export const RESCHEDULE_NO_CHOICE = "No answer, or the client didn't choose a time"

export type RescheduleFollowUp = 'book_offered' | 'request_other' | 'already_settled'

/** Instants the team actually offered, ignoring anything that is not a timestamp. */
export function offeredInstants(alternatives: unknown): number[] {
  if (!Array.isArray(alternatives)) return []
  const out: number[] = []
  for (const item of alternatives) {
    if (typeof item !== 'string') continue
    const t = new Date(item).getTime()
    if (Number.isFinite(t)) out.push(t)
  }
  return out
}

/**
 * What this tool call is allowed to do.
 * A time the team offered is booked as confirmed. Any other open time is only a
 * new request. A call that is no longer `offered` must not write another row.
 */
export function decideRescheduleFollowUp(input: {
  rescheduleStatus: string | null | undefined
  requestedIso: string | null
  alternatives: unknown
}): RescheduleFollowUp {
  if (input.rescheduleStatus !== 'offered') return 'already_settled'
  const when = input.requestedIso ? new Date(input.requestedIso).getTime() : Number.NaN
  if (Number.isFinite(when) && offeredInstants(input.alternatives).includes(when)) return 'book_offered'
  return 'request_other'
}
