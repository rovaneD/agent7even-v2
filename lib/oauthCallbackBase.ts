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

/** Prefer the host the user is actually on — avoids redirect_uri_mismatch when env is stale. */
export function oauthCallbackBaseFromRequest(req: Request): string {
  const forwardedHost = req.headers.get('x-forwarded-host')
  const host = forwardedHost?.split(',')[0]?.trim() || req.headers.get('host')
  if (host) {
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
    return `${proto}://${host}`.replace(/\/$/, '')
  }
  return oauthCallbackBase()
}

export function gaOAuthRedirectUri(req: Request): string {
  return `${oauthCallbackBaseFromRequest(req)}/api/analytics/ga-callback`
}
