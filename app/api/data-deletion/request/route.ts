import { NextResponse } from 'next/server'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { getResendClient } from '@/lib/resend'

const REQUEST_TYPE_LABELS: Record<string, string> = {
  full_account: 'Full account deletion',
  connected_accounts: 'Connected integration data only',
  meta_platform: 'Meta / Instagram / Facebook data',
  other: 'Other',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function POST(req: Request) {
  let body: {
    fullName?: string
    email?: string
    accountEmail?: string
    requestType?: string
    details?: string
    website?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Honeypot — bots only
  if (body.website?.trim()) {
    return NextResponse.json({ referenceId: 'received' })
  }

  const fullName = body.fullName?.trim() ?? ''
  const email = body.email?.trim().toLowerCase() ?? ''
  const accountEmail = body.accountEmail?.trim().toLowerCase() ?? ''
  const requestType = body.requestType?.trim() ?? 'full_account'
  const details = body.details?.trim() ?? ''

  if (!fullName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid name and email are required.' }, { status: 400 })
  }

  if (!REQUEST_TYPE_LABELS[requestType]) {
    return NextResponse.json({ error: 'Invalid request type.' }, { status: 400 })
  }

  const referenceId = `DEL-${Date.now().toString(36).toUpperCase()}`
  const requestLabel = REQUEST_TYPE_LABELS[requestType]
  const notifyEmail = await getNotifyEmail()
  const resend = getResendClient()

  if (!resend) {
    console.error('[data-deletion/request] Missing RESEND_API_KEY')
    return NextResponse.json({ error: 'Email service unavailable. Please email support@agent7even.ai directly.' }, { status: 503 })
  }

  const safeName = escapeHtml(fullName)
  const safeEmail = escapeHtml(email)
  const safeAccountEmail = escapeHtml(accountEmail || 'Same as contact email')
  const safeDetails = escapeHtml(details || 'None provided')

  try {
    await resend.emails.send({
      from: 'Agent7even <noreply@agent7even.com>',
      to: notifyEmail,
      replyTo: email,
      subject: `Data deletion request — ${referenceId}`,
      html: `
        <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; line-height: 1.6;">
          <h2 style="color: #0f172a; margin-bottom: 8px;">User data deletion request</h2>
          <p style="color: #64748b; font-size: 13px;">Reference: <strong>${referenceId}</strong></p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Contact email:</strong> ${safeEmail}</p>
          <p><strong>Account email:</strong> ${safeAccountEmail}</p>
          <p><strong>Request type:</strong> ${escapeHtml(requestLabel)}</p>
          <p><strong>Details:</strong></p>
          <p style="white-space: pre-wrap; color: #334155;">${safeDetails}</p>
        </div>
      `,
    })

    await resend.emails.send({
      from: 'Agent7even <noreply@agent7even.com>',
      to: email,
      subject: `We received your data deletion request (${referenceId})`,
      html: `
        <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; line-height: 1.6;">
          <h2 style="color: #0f172a;">Data deletion request received</h2>
          <p>Hi ${safeName},</p>
          <p>
            We received your request to delete data associated with Agent7even.
            Reference: <strong>${referenceId}</strong>.
          </p>
          <p>
            We will verify your identity using the email address provided and respond within 30 days,
            usually sooner. If we need additional information, we will reply to this email.
          </p>
          <p style="color: #64748b; font-size: 13px;">
            Agent7even · <a href="https://www.agent7even.ai/privacy">Privacy Policy</a>
          </p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[data-deletion/request] email failed:', err)
    return NextResponse.json({ error: 'Could not submit request. Please email support@agent7even.ai directly.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, referenceId })
}
