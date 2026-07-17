import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { track } from '@vercel/analytics/server'
import { createServiceClient } from '@/lib/supabase/server'
import { welcomeEmailHtml, welcomeEmailText } from '@/emails/welcome'
import { getResendClient } from '@/lib/resend'
import { transactionalFromAddress } from '@/lib/email/transactionalTemplate'
import { activateTeamInviteForProfile } from '@/lib/team/activateTeamInvite'

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

    // Same email + new Clerk user used to create a second profile row. Reuse canonical.
    if (email) {
      const { data: existingByEmail } = await supabase
        .from('profiles')
        .select('id, clerk_user_id, stripe_customer_id, stripe_subscription_id, plan, status, created_at')
        .ilike('email', email)
        .neq('status', 'churned')
        .order('created_at', { ascending: true })

      const others = (existingByEmail ?? []).filter(p => p.clerk_user_id !== id)
      if (others.length > 0) {
        const canonical = [...(existingByEmail ?? [])].sort((a, b) => {
          if (a.stripe_customer_id && !b.stripe_customer_id) return -1
          if (!a.stripe_customer_id && b.stripe_customer_id) return 1
          if (a.plan && !b.plan) return -1
          if (!a.plan && b.plan) return 1
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })[0]

        await supabase
          .from('profiles')
          .update({
            clerk_user_id: id,
            full_name: fullName || undefined,
            ...(image_url ? { avatar_url: image_url } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', canonical.id)

        const orphanIds = (existingByEmail ?? [])
          .filter(p => p.id !== canonical.id && !p.stripe_customer_id && !p.stripe_subscription_id)
          .map(p => p.id)

        if (orphanIds.length > 0) {
          await supabase.from('profiles').delete().in('id', orphanIds)
        }

        await activateTeamInviteForProfile(supabase, canonical.id, email)

        console.warn('[clerk/webhook] Blocked duplicate profile for email', email, {
          clerkUserId: id,
          canonicalProfileId: canonical.id,
          removedOrphans: orphanIds,
        })

        return new Response('OK', { status: 200 })
      }
    }

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
    let joinedViaTeamInvite = false
    if (newProfile?.id && email) {
      const teamActivation = await activateTeamInviteForProfile(supabase, newProfile.id, email)
      if (teamActivation?.activated) joinedViaTeamInvite = true
    }

    // Welcome email — skip for team invitees (they already got an invite email)
    if (email && !joinedViaTeamInvite) {
      try {
        const resend = getResendClient()
        if (!resend) throw new Error('Missing RESEND_API_KEY')

        await resend.emails.send({
          from: transactionalFromAddress(),
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

    if (newProfile?.id && !error) {
      try {
        await track('Signup', {
          source: 'clerk_webhook',
          team_invite: joinedViaTeamInvite,
        })
      } catch (trackError) {
        console.error('Vercel analytics track failed (Signup):', trackError)
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
