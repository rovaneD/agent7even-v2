import { getResendClient } from '@/lib/resend'
import { buildTransactionalEmailHtml, transactionalFromAddress } from '@/lib/email/transactionalTemplate'

type SendTransactionalEmailParams = {
  to: string | string[]
  subject: string
  title: string
  body: string
  link?: string
  ctaLabel?: string
  from?: string
  text?: string
  replyTo?: string | string[]
}

export async function sendTransactionalEmail(params: SendTransactionalEmailParams): Promise<void> {
  const resend = getResendClient()
  if (!resend) throw new Error('Missing RESEND_API_KEY')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.agent7even.ai'

  await resend.emails.send({
    from: params.from ?? transactionalFromAddress(),
    to: params.to,
    subject: params.subject,
    replyTo: params.replyTo,
    html: buildTransactionalEmailHtml({
      title: params.title,
      body: params.body,
      link: params.link,
      appBaseUrl: appUrl,
      ctaLabel: params.ctaLabel,
    }),
    text: params.text,
  })
}
