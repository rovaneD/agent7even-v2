import { sanitizeSecretEnvValue } from '@/lib/stripe'
import {
  assessGoogleOAuthConfig,
  probeGoogleOAuthLive,
  type GoogleOAuthLiveProbe,
} from '@/lib/googleOAuth'

export type IntegrationHealthStatus = 'ok' | 'warning' | 'error' | 'unconfigured'

export type IntegrationHealthItem = {
  id: string
  label: string
  status: IntegrationHealthStatus
  message: string
  hint?: string
}

export type IntegrationsHealthReport = {
  checkedAt: string
  deployment: {
    vercelEnv: string | null
    appUrl: string | null
  }
  items: IntegrationHealthItem[]
  allOk: boolean
}

function envPresent(key: string): boolean {
  return Boolean(sanitizeSecretEnvValue(process.env[key]))
}

function envNotPlaceholder(key: string): boolean {
  const val = sanitizeSecretEnvValue(process.env[key])
  return Boolean(val && val !== 'placeholder')
}

function assessEnvVar(
  id: string,
  label: string,
  key: string,
  hint: string,
): IntegrationHealthItem {
  const val = sanitizeSecretEnvValue(process.env[key])
  if (!val) {
    return { id, label, status: 'unconfigured', message: 'Not configured on this deployment.', hint }
  }
  if (val === 'placeholder') {
    return {
      id,
      label,
      status: 'error',
      message: `${key} is the CI placeholder — set production credentials in Vercel.`,
      hint,
    }
  }
  return { id, label, status: 'ok', message: `${key} is set.`, hint }
}

function assessEnvPair(
  id: string,
  label: string,
  keys: [string, string],
  hint: string,
): IntegrationHealthItem {
  const [a, b] = keys
  const hasA = envPresent(a)
  const hasB = envPresent(b)
  if (!hasA && !hasB) {
    return { id, label, status: 'unconfigured', message: 'Not configured on this deployment.', hint }
  }
  if (!hasA || !hasB) {
    return {
      id,
      label,
      status: 'error',
      message: `Missing ${!hasA ? a : b}.`,
      hint,
    }
  }
  if (!envNotPlaceholder(a) || !envNotPlaceholder(b)) {
    return {
      id,
      label,
      status: 'error',
      message: 'CI placeholder values detected — set production credentials in Vercel.',
      hint,
    }
  }
  return { id, label, status: 'ok', message: 'Environment variables present.', hint }
}

function assessGoogleServiceAccount(): IntegrationHealthItem {
  const email = sanitizeSecretEnvValue(process.env.GOOGLE_SA_CLIENT_EMAIL)
  const key = sanitizeSecretEnvValue(process.env.GOOGLE_SA_PRIVATE_KEY)?.replace(/\\n/g, '\n')
  const id = 'google_service_account'
  const label = 'Google Analytics (service account)'
  const hint = 'Set GOOGLE_SA_CLIENT_EMAIL and GOOGLE_SA_PRIVATE_KEY for manual property IDs.'

  if (!email && !key) {
    return { id, label, status: 'unconfigured', message: 'Not configured on this deployment.', hint }
  }
  if (!email || !key) {
    return {
      id,
      label,
      status: 'error',
      message: `Missing ${!email ? 'GOOGLE_SA_CLIENT_EMAIL' : 'GOOGLE_SA_PRIVATE_KEY'}.`,
      hint,
    }
  }
  if (!email.endsWith('.iam.gserviceaccount.com')) {
    return {
      id,
      label,
      status: 'warning',
      message: 'GOOGLE_SA_CLIENT_EMAIL does not look like a service account email.',
      hint,
    }
  }
  if (!key.includes('BEGIN PRIVATE KEY')) {
    return {
      id,
      label,
      status: 'error',
      message: 'GOOGLE_SA_PRIVATE_KEY is missing PEM headers.',
      hint,
    }
  }
  return { id, label, status: 'ok', message: 'Service account credentials present.', hint }
}

function googleOAuthItemFromAssessment(
  live: GoogleOAuthLiveProbe,
  connectedTenantCount: number,
): IntegrationHealthItem {
  const id = 'google_oauth'
  const label = 'Google Analytics OAuth'
  const hint =
    'Copy GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET from GCP project agent7even-analytics. ' +
    'After rotation, redeploy and verify reconnect on the Google analytics tab.'

  const assessment = assessGoogleOAuthConfig()
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID && !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return { id, label, status: 'unconfigured', message: 'Not configured on this deployment.', hint }
  }
  if (!assessment.ok) {
    return {
      id,
      label,
      status: 'error',
      message: assessment.issues.map(i => i.message).join(' '),
      hint,
    }
  }

  if (live.status === 'invalid_client') {
    return { id, label, status: 'error', message: live.reason, hint }
  }
  if (live.status === 'token_refresh_failed') {
    return {
      id,
      label,
      status: connectedTenantCount > 0 ? 'warning' : 'ok',
      message: live.reason,
      hint,
    }
  }
  if (live.status === 'skipped') {
    return {
      id,
      label,
      status: 'ok',
      message: `Static checks passed. Live probe skipped: ${live.reason}`,
      hint,
    }
  }

  return {
    id,
    label,
    status: 'ok',
    message:
      connectedTenantCount > 0
        ? `Credentials verified with Google (${connectedTenantCount} connected tenant${connectedTenantCount === 1 ? '' : 's'}).`
        : 'Credentials format OK. Live token exchange verified with Google.',
    hint,
  }
}

export async function getIntegrationsHealth(options?: {
  sampleRefreshToken?: string | null
  connectedGaTenantCount?: number
}): Promise<IntegrationsHealthReport> {
  const connectedGaTenantCount = options?.connectedGaTenantCount ?? 0
  const live = await probeGoogleOAuthLive(options?.sampleRefreshToken)

  const items: IntegrationHealthItem[] = [
    googleOAuthItemFromAssessment(live, connectedGaTenantCount),
    assessGoogleServiceAccount(),
    assessEnvVar('zernio', 'Social posting & analytics', 'ZERNIO_API_KEY', 'ZERNIO_API_KEY from Zernio dashboard.'),
    assessEnvPair('meta_oauth', 'Meta OAuth', ['META_APP_ID', 'META_APP_SECRET'], 'Meta Marketing API app credentials.'),
  ]

  const blocking = items.filter(i => i.status === 'error')
  return {
    checkedAt: new Date().toISOString(),
    deployment: {
      vercelEnv: process.env.VERCEL_ENV ?? null,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    },
    items,
    allOk: blocking.length === 0,
  }
}
