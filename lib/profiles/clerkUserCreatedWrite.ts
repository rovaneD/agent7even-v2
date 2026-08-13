/**
 * Clerk delivers `user.created` at least once (retries after timeouts/5xx,
 * dashboard replay). The handler must never UPDATE lifecycle columns on conflict.
 *
 * A PostgREST upsert of `{ role, status, onboarding_complete }` would reset a
 * live paying (or admin) profile back to a new-signup row.
 */

export type ClerkUserCreatedEmailMatch = {
  clerk_user_id: string | null
}

export type ClerkUserCreatedAction = 'noop' | 'relink_email' | 'insert'

export function decideClerkUserCreatedAction(opts: {
  existingByClerkUserId: { id: string } | null
  emailMatches: ClerkUserCreatedEmailMatch[]
  incomingClerkUserId: string
}): ClerkUserCreatedAction {
  if (opts.existingByClerkUserId) return 'noop'

  const others = opts.emailMatches.filter(
    (row) => row.clerk_user_id !== opts.incomingClerkUserId,
  )
  if (others.length > 0) return 'relink_email'

  return 'insert'
}

/** True when a unique-violation should be treated as a successful redelivery. */
export function isClerkProfileUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505'
}
