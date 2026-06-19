/**
 * Base URL for OAuth provider redirect_uri values.
 * Preview deployments use VERCEL_URL so callbacks hit the same deployment.
 * Production uses NEXT_PUBLIC_APP_URL (www.agent7even.ai) so redirects match the logged-in host.
 */
export function oauthCallbackBase(): string {
  const canonical = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (process.env.VERCEL_ENV === 'production' && canonical) {
    return canonical
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return canonical ?? 'http://localhost:3000'
}
