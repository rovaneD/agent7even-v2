/**
 * One reschedule call may create one follow-up.
 * The client can still pick while the offer is open (`rescheduleOfferOpen`).
 * A repeated tool call after that must not insert another appointment.
 */

/** Dashboard line when the client rejected the offered times and asked for another. */
export const RESCHEDULE_OTHER_TIME = 'Client asked for a different time. Confirm the new request.'

/** Dashboard line when the reschedule call ended and the offer is still open. */
export const RESCHEDULE_NO_CHOICE = "No answer, or the client didn't choose a time"

export type RescheduleFollowUp = 'book_offered' | 'request_other' | 'already_settled'

/**
 * The client can still pick.
 * `offered` is the normal wait. `callback_needed` with the no-choice note is the
 * same wait after this call's own webhook landed while the tool was still saving.
 * Any other callback note (a different time, a failed dial) is already settled.
 */
export function rescheduleOfferOpen(
  status: string | null | undefined,
  callbackError: string | null | undefined,
): boolean {
  return status === 'offered'
    || (status === 'callback_needed' && callbackError === RESCHEDULE_NO_CHOICE)
}

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
 * new request. A closed offer must not write another row. The no-choice note is
 * still open: this call's webhook can land before the tool finishes saving.
 */
export function decideRescheduleFollowUp(input: {
  rescheduleStatus: string | null | undefined
  requestedIso: string | null
  alternatives: unknown
  callbackError?: string | null
}): RescheduleFollowUp {
  if (!rescheduleOfferOpen(input.rescheduleStatus, input.callbackError)) return 'already_settled'
  const when = input.requestedIso ? new Date(input.requestedIso).getTime() : Number.NaN
  if (Number.isFinite(when) && offeredInstants(input.alternatives).includes(when)) return 'book_offered'
  return 'request_other'
}
