/** Normalize profile website URLs for Maya prompts and form validation. */

export function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let url = raw.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const parsed = new URL(url)
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return raw.trim()
  }
}

export function websiteHost(raw: string | null | undefined): string | null {
  const normalized = normalizeWebsiteUrl(raw)
  if (!normalized) return null
  try {
    return new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

export function websitesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const hostA = websiteHost(a)
  const hostB = websiteHost(b)
  if (!hostA || !hostB) return false
  return hostA === hostB
}
