import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { track } from '@vercel/analytics/server'
import { createServiceClient } from '@/lib/supabase/server'
import { welcomeEmailHtml, welcomeEmailText } from '@/emails/welcome'
import { getResendClient } from '@/lib/resend'
import { transactionalFromAddress } from '@/lib/email/transactionalTemplate'
import { notifyAdminNewSignupOnce } from '@/lib/notifyAdminNewSignup'
import { handleClerkUserCreated } from '@/lib/auth/handleClerkUserCreated'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Missing CLERK_WEBHOOK_SIGNING_SECRET')
  }

  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return new Response('Verification failed', { status: 400 })
  }

  const supabase = createServiceClient()

  if (evt.type === 'user.created') {
    const result = await handleClerkUserCreated(supabase, evt.data, {
      sendWelcome: async ({ email, firstName }) => {
        const resend = getResendClient()
        if (!resend) throw new Error('Missing RESEND_API_KEY')
        await resend.emails.send({
          from: transactionalFromAddress(),
          to: email,
          subject: 'Welcome to Agent7even — your portal is ready',
          html: welcomeEmailHtml(firstName),
          text: welcomeEmailText(firstName),
        })
      },
      notifyAdmin: notifyAdminNewSignupOnce,
      trackSignup: async ({ teamInvite }) => {
        await track('Signup', {
          source: 'clerk_webhook',
          team_invite: teamInvite,
        })
      },
    })

    if (result.action === 'skipped_atlas_only') {
      console.info('[clerk/webhook] Atlas-only signup — skip Maya enrollment and welcome')
    }
  }

  if (evt.type === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data

    const email = email_addresses?.[0]?.email_address ?? ''
    const fullName = [first_name, last_name].filter(Boolean).join(' ')

    const { error } = await supabase
      .from('profiles')
      .update({
        email,
        full_name: fullName,
        ...(image_url ? { avatar_url: image_url } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', id)

    if (error) {
      console.error('Supabase update error (user.updated):', error)
    }
  }

  if (evt.type === 'user.deleted') {
    const { id } = evt.data

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'churned', updated_at: new Date().toISOString() })
      .eq('clerk_user_id', id)

    if (error) {
      console.error('Supabase update error (user.deleted):', error)
    }
  }

  return new Response('OK', { status: 200 })
}
