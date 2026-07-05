import { NextResponse } from 'next/server'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'

const REQUEST_TYPE_LABELS: Record<string, string> = {
  full_account: 'Full account deletion',
  connected_accounts: 'Connected integration data only',
  meta_platform: 'Meta / Instagram / Facebook data',
  other: 'Other',
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

  const adminBody = [
    `Reference: ${referenceId}`,
    `Name: ${fullName}`,
    `Contact email: ${email}`,
    `Account email: ${accountEmail || 'Same as contact email'}`,
    `Request type: ${requestLabel}`,
    `Details: ${details || 'None provided'}`,
  ].join('\n')

  const confirmationBody = [
    `Hi ${fullName},`,
    '',
    `We received your request to delete data associated with Agent7even. Reference: ${referenceId}.`,
    '',
    'We will verify your identity using the email address provided and respond within 30 days, usually sooner. If we need additional information, we will reply to this email.',
  ].join('\n')

  try {
    await sendTransactionalEmail({
      to: notifyEmail,
      replyTo: email,
      subject: `Data deletion request — ${referenceId}`,
      title: 'User data deletion request',
      body: adminBody,
    })

    await sendTransactionalEmail({
      to: email,
      subject: `We received your data deletion request (${referenceId})`,
      title: 'Data deletion request received',
      body: confirmationBody,
    })
  } catch (err) {
    console.error('[data-deletion/request] email failed:', err)
    return NextResponse.json({ error: 'Could not submit request. Please email support@agent7even.ai directly.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, referenceId })
}
