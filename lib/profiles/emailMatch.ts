/**
 * Profile email matching must be case-insensitive and literal.
 *
 * PostgREST `.ilike('email', value)` is SQL ILIKE: `_` matches any single
 * character and `%` / PostgREST `*` are wildcards. Corporate addresses like
 * `jane_doe@acme.com` would otherwise match `jane.doe@acme.com` and relink
 * that paying profile's `clerk_user_id` to the new signup.
 */

export function normalizeProfileEmail(email: string): string {
  return email.trim()
}

export function emailsMatch(
  stored: string | null | undefined,
  lookup: string | null | undefined,
): boolean {
  if (!stored || !lookup) return false
  return stored.trim().toLowerCase() === lookup.trim().toLowerCase()
}

export function filterRowsByExactEmail<T extends { email?: string | null }>(
  rows: T[] | null | undefined,
  lookup: string,
): T[] {
  const needle = normalizeProfileEmail(lookup)
  if (!needle) return []
  return (rows ?? []).filter(row => emailsMatch(row.email, needle))
}

export function selectWithEmail(select: string): string {
  const fields = select.split(',').map(field => field.trim()).filter(Boolean)
  if (!fields.includes('email')) fields.push('email')
  return fields.join(', ')
}
