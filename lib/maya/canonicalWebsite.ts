/** Normalize profile website URLs for Maya prompts and form validation. */

export function normalizeWebsiteUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let url = raw.trim()
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url) && !/^https?:\/\//i.test(url)) return null
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const parsed = new URL(url)
    if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || !parsed.hostname) return null
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return null
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
