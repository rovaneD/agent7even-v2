import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { welcomeEmailHtml, welcomeEmailText } from '@/emails/welcome'
import { getResendClient } from '@/lib/resend'

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
    const { id, email_addresses, first_name, last_name, image_url } = evt.data

    const email = email_addresses?.[0]?.email_address ?? ''
    const fullName = [first_name, last_name].filter(Boolean).join(' ')

    const { data: newProfile, error } = await supabase.from('profiles').upsert({
      clerk_user_id: id,
      email,
      full_name: fullName,
      avatar_url: image_url ?? '',
      role: 'client',
      status: 'onboarding',
      onboarding_complete: false,
    }, { onConflict: 'clerk_user_id' }).select('id').single()

    if (error) {
      console.error('Supabase upsert error (user.created):', error)
    }

    // Activate any pending team invite for this email
    if (newProfile?.id && email) {
      const { data: pendingInvite } = await supabase
        .from('team_members')
        .select('id, account_id')
        .eq('invited_email', email.toLowerCase())
        .eq('status', 'pending')
        .single()

      if (pendingInvite) {
        await supabase.from('team_members').update({
          member_profile_id: newProfile.id,
          status: 'active',
          updated_at: new Date().toISOString(),
        }).eq('id', pendingInvite.id)

        await supabase.from('profiles').update({
          account_id: pendingInvite.account_id,
          is_account_owner: false,
          updated_at: new Date().toISOString(),
        }).eq('id', newProfile.id)
      }
    }

    // Send welcome email
    if (email) {
      try {
        const resend = getResendClient()
        if (!resend) throw new Error('Missing RESEND_API_KEY')

        await resend.emails.send({
          from: 'Agent7even <hello@agent7even.com>',
          to: email,
          subject: 'Welcome to Agent7even — your portal is ready',
          html: welcomeEmailHtml(first_name ?? ''),
          text: welcomeEmailText(first_name ?? ''),
        })
      } catch (emailError) {
        // Log but don't fail the webhook — user is still created
        console.error('Welcome email failed:', emailError)
      }
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
        avatar_url: image_url ?? '',
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
