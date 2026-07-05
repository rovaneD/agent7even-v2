import { CANONICAL_APP_URL, SUPPORT_EMAIL } from '@/lib/siteUrls'
import { buildTransactionalEmailHtml } from '@/lib/email/transactionalTemplate'

export function welcomeEmailHtml(firstName: string): string {
  const name = firstName || 'there'
  const body = [
    `Your account is set up. Here is what to do first:`,
    '',
    `1. Complete Foundation — Maya uses this as the source of truth for your brand.`,
    `2. Explore the AI Toolkit — run your first agent or generate content.`,
    `3. Connect your accounts — unlock live analytics and publishing when you are on a paid plan.`,
    '',
    `Questions? Reply to this email or contact ${SUPPORT_EMAIL}.`,
  ].join('\n')

  return buildTransactionalEmailHtml({
    title: `Welcome, ${name}.`,
    body,
    link: '/dashboard',
    appBaseUrl: CANONICAL_APP_URL,
    ctaLabel: 'Open your dashboard →',
  })
}

export function welcomeEmailText(firstName: string): string {
  const name = firstName || 'there'
  return `Welcome, ${name}.

Your Agent7even account is ready.

Open your dashboard: ${CANONICAL_APP_URL}/dashboard

Questions? ${SUPPORT_EMAIL}`
}
