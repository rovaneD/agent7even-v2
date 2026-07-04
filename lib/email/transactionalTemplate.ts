import { CANONICAL_SITE_URL, SUPPORT_EMAIL } from '@/lib/siteUrls'

/** v2 transactional email tokens — match dashboard (blue primary, pink logo only). */
export const EMAIL_BRAND = {
  primary: '#3B82F6',
  primaryHover: '#2563EB',
  logoAccent: '#F5349B',
  textPrimary: '#2D3748',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  border: '#E2E8F0',
} as const

/** Resend "from" — override with RESEND_FROM in env if needed. */
export function transactionalFromAddress(): string {
  return process.env.RESEND_FROM?.trim() || 'Agent7even <hello@agent7even.ai>'
}

export function buildTransactionalEmailHtml(opts: {
  title: string
  body: string
  link?: string
  appBaseUrl: string
  ctaLabel?: string
}): string {
  const { title, body, link, appBaseUrl, ctaLabel = 'View in dashboard →' } = opts
  const href = link ? `${appBaseUrl.replace(/\/$/, '')}${link.startsWith('/') ? link : `/${link}`}` : null
  const b = EMAIL_BRAND

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${b.surfaceMuted};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${b.surfaceMuted};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${b.surface};border:1px solid ${b.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid ${b.border};">
              <span style="font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${b.logoAccent};">Agent7even</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;line-height:1.35;color:${b.textPrimary};">${escapeHtml(title)}</h1>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:${b.textSecondary};">${escapeHtml(body)}</p>
              ${href ? `
              <a href="${escapeHtml(href)}" style="display:inline-block;background:${b.primary};color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:14px 24px;border-radius:12px;">
                ${escapeHtml(ctaLabel)}
              </a>
              ` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid ${b.border};background:${b.surfaceMuted};">
              <p style="margin:0;font-size:12px;line-height:1.6;color:${b.textMuted};">
                Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:${b.primary};text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:${b.textMuted};">
                <a href="${CANONICAL_SITE_URL}" style="color:${b.textMuted};text-decoration:none;">agent7even.ai</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
