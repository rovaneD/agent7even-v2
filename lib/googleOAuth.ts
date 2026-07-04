import { sanitizeSecretEnvValue } from '@/lib/stripe'

export type GoogleOAuthCredentials = {
  clientId: string
  clientSecret: string
}

export type GoogleOAuthConfigIssueCode =
  | 'missing_client_id'
  | 'missing_client_secret'
  | 'placeholder'
  | 'invalid_client_id_format'
  | 'invalid_client_secret_format'
  | 'sanitized_mismatch'

export type GoogleOAuthConfigIssue = {
  code: GoogleOAuthConfigIssueCode
  message: string
}

const CLIENT_ID_RE = /^\d+-[\w-]+\.apps\.googleusercontent\.com$/
const CLIENT_SECRET_RE = /^GOCSPX-[\w-]+$/

function clientIdFormatOk(value: string): boolean {
  return CLIENT_ID_RE.test(value)
}

function clientSecretFormatOk(value: string): boolean {
  return CLIENT_SECRET_RE.test(value)
}

/** Sanitized Google OAuth app credentials — strips pasted quotes/newlines that cause invalid_client. */
export function getGoogleOAuthCredentials(): GoogleOAuthCredentials | null {
  const assessment = assessGoogleOAuthConfig()
  return assessment.credentials
}

/** Static validation — format, presence, placeholder, paste corruption. */
export function assessGoogleOAuthConfig(): {
  ok: boolean
  issues: GoogleOAuthConfigIssue[]
  credentials: GoogleOAuthCredentials | null
} {
  const issues: GoogleOAuthConfigIssue[] = []
  const rawClientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? ''
  const rawClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? ''
  const clientId = sanitizeSecretEnvValue(rawClientId)
  const clientSecret = sanitizeSecretEnvValue(rawClientSecret)

  if (rawClientId && rawClientId !== clientId) {
    issues.push({
      code: 'sanitized_mismatch',
      message: 'GOOGLE_OAUTH_CLIENT_ID has extra whitespace or wrapping quotes — re-save in Vercel.',
    })
  }
  if (rawClientSecret && rawClientSecret !== clientSecret) {
    issues.push({
      code: 'sanitized_mismatch',
      message: 'GOOGLE_OAUTH_CLIENT_SECRET has extra whitespace or wrapping quotes — re-save in Vercel.',
    })
  }

  if (!clientId) {
    issues.push({ code: 'missing_client_id', message: 'GOOGLE_OAUTH_CLIENT_ID is not set.' })
  } else if (clientId === 'placeholder') {
    issues.push({ code: 'placeholder', message: 'GOOGLE_OAUTH_CLIENT_ID is the CI placeholder.' })
  } else if (!clientIdFormatOk(clientId)) {
    issues.push({
      code: 'invalid_client_id_format',
      message: 'GOOGLE_OAUTH_CLIENT_ID does not look like a Google OAuth client ID.',
    })
  }

  if (!clientSecret) {
    issues.push({ code: 'missing_client_secret', message: 'GOOGLE_OAUTH_CLIENT_SECRET is not set.' })
  } else if (clientSecret === 'placeholder') {
    issues.push({ code: 'placeholder', message: 'GOOGLE_OAUTH_CLIENT_SECRET is the CI placeholder.' })
  } else if (!clientSecretFormatOk(clientSecret)) {
    issues.push({
      code: 'invalid_client_secret_format',
      message: 'GOOGLE_OAUTH_CLIENT_SECRET must start with GOCSPX- (full value from GCP Credentials).',
    })
  }

  const credentials =
    clientId && clientSecret && clientId !== 'placeholder' && clientSecret !== 'placeholder'
      ? { clientId, clientSecret }
      : null

  const ok = issues.length === 0
  return { ok, issues, credentials }
}

export type GoogleOAuthLiveProbe =
  | { status: 'ok' }
  | { status: 'skipped'; reason: string }
  | { status: 'invalid_client'; reason: string }
  | { status: 'token_refresh_failed'; reason: string }

/** Live probe — refresh a stored tenant token to verify client secret with Google. */
export async function probeGoogleOAuthLive(refreshToken: string | null | undefined): Promise<GoogleOAuthLiveProbe> {
  const assessment = assessGoogleOAuthConfig()
  if (!assessment.ok || !assessment.credentials) {
    return { status: 'skipped', reason: 'OAuth credentials are not configured on this deployment.' }
  }
  if (!refreshToken) {
    return { status: 'skipped', reason: 'No connected GA refresh token to test against Google.' }
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: assessment.credentials.clientId,
      client_secret: assessment.credentials.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string }

  if (data.error === 'invalid_client') {
    return {
      status: 'invalid_client',
      reason: 'Google rejected the client secret (invalid_client). Re-paste GOCSPX-… from GCP into Vercel.',
    }
  }
  if (data.access_token) {
    return { status: 'ok' }
  }
  return {
    status: 'token_refresh_failed',
    reason: data.error_description ?? data.error ?? 'Token refresh failed — tenant may need to reconnect GA.',
  }
}

export type GoogleTokenRefreshResult = {
  accessToken: string | null
  error?: string
  errorCode?: string
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenRefreshResult> {
  const creds = getGoogleOAuthCredentials()
  if (!creds) {
    return { accessToken: null, error: 'OAuth credentials not configured', errorCode: 'missing_credentials' }
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = (await res.json()) as {
    access_token?: string
    error?: string
    error_description?: string
  }

  if (data.access_token) {
    return { accessToken: data.access_token }
  }

  return {
    accessToken: null,
    error: data.error_description ?? data.error ?? 'Token refresh failed',
    errorCode: data.error,
  }
}
