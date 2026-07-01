import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getResendClient } from '@/lib/resend'
import { getStripeClient } from '@/lib/stripe'
import { randomUUID } from 'crypto'

const PLAN_SEAT_LIMITS: Record<string, number> = {
  starter: 1,
  growth: 3,
  proagent: 5,
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, role, permissions, confirmedExtraSeat } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, plan, stripe_subscription_id, is_account_owner')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (!profile.is_account_owner) return NextResponse.json({ error: 'Only account owners can invite members' }, { status: 403 })

  // Check if already invited
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('account_id', profile.id)
    .eq('invited_email', email.toLowerCase())
    .single()

  if (existing) return NextResponse.json({ error: 'This email has already been invited' }, { status: 400 })

  // Count current members
  const { count: currentMembers } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', profile.id)
    .neq('status', 'removed')

  const includedSeats = PLAN_SEAT_LIMITS[profile.plan ?? ''] ?? 1
  const currentExtraSeats = Math.max(0, (currentMembers ?? 0) + 1 - includedSeats) // +1 for owner
  const needsExtraSeat = Math.max(0, (currentMembers ?? 0) + 2 - includedSeats) > currentExtraSeats

  if (needsExtraSeat && !profile.stripe_subscription_id) {
    return NextResponse.json({ error: 'A paid subscription is required before inviting extra team seats.' }, { status: 402 })
  }

  if (needsExtraSeat && confirmedExtraSeat !== true) {
    return NextResponse.json({ error: 'extra_seat_confirmation_required' }, { status: 409 })
  }

  // Generate invite token
  const inviteToken = randomUUID()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'
  const inviteUrl = `${appUrl}/api/team/accept?token=${inviteToken}`

  // Create team member record
  const { data: member, error } = await supabase
    .from('team_members')
    .insert({
      account_id: profile.id,
      role: role ?? 'member',
      permissions: permissions ?? {},
      status: 'pending',
      invited_email: email.toLowerCase(),
      invite_token: inviteToken,
    })
    .select()
    .single()

  if (error) {
    console.error('Team member insert error:', error)
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }

  const { count: membersAfterInsert } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', profile.id)
    .neq('status', 'removed')

  const extraSeatsAfterInsert = Math.max(0, (membersAfterInsert ?? 0) + 1 - includedSeats)
  const addedExtraSeat = extraSeatsAfterInsert > currentExtraSeats

  if (addedExtraSeat && !profile.stripe_subscription_id) {
    await supabase.from('team_members').delete().eq('id', member.id)
    return NextResponse.json({ error: 'A paid subscription is required before inviting extra team seats.' }, { status: 402 })
  }

  if (addedExtraSeat && confirmedExtraSeat !== true) {
    await supabase.from('team_members').delete().eq('id', member.id)
    return NextResponse.json({ error: 'extra_seat_confirmation_required' }, { status: 409 })
  }

  // Add extra seat to Stripe subscription only after the invite row exists.
  if (addedExtraSeat && profile.stripe_subscription_id) {
    try {
      const stripe = getStripeClient()
      if (!stripe) throw new Error('Billing is not configured')

      const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
      const existingSeatItem = subscription.items.data.find(
        item => item.price.id === process.env.STRIPE_SEAT_PRICE_ID
      )

      if (existingSeatItem) {
        await stripe.subscriptionItems.update(existingSeatItem.id, {
          quantity: extraSeatsAfterInsert,
        })
      } else {
        await stripe.subscriptionItems.create({
          subscription: profile.stripe_subscription_id,
          price: process.env.STRIPE_SEAT_PRICE_ID!,
          quantity: extraSeatsAfterInsert,
        })
      }
    } catch (err) {
      console.error('Stripe seat add error:', err)
      await supabase.from('team_members').delete().eq('id', member.id)
      return NextResponse.json({ error: 'Failed to add seat to subscription. Please check your billing.' }, { status: 500 })
    }
  }

  // Send invite email
  try {
    const resend = getResendClient()
    if (!resend) throw new Error('Missing RESEND_API_KEY')

    await resend.emails.send({
      from: 'Agent7even <hello@agent7even.com>',
      to: email,
      subject: `You've been invited to join ${profile.company_name ?? 'a team'} on Agent7even`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d0d; border-radius: 12px; overflow: hidden;">
          <div style="padding: 32px 40px 24px; border-bottom: 1px solid #1f1f1f;">
            <span style="font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #c8522a;">Agent7even</span>
          </div>
          <div style="padding: 40px;">
            <h2 style="font-size: 22px; font-weight: 600; color: #f5f4f0; margin: 0 0 12px;">You've been invited</h2>
            <p style="font-size: 15px; color: #888; line-height: 1.7; margin: 0 0 8px;">
              <strong style="color: #f5f4f0;">${profile.company_name ?? 'Your team'}</strong> has invited you to join their Agent7even dashboard.
            </p>
            <p style="font-size: 15px; color: #888; line-height: 1.7; margin: 0 0 32px;">
              Click the button below to accept your invitation and set up your account.
            </p>
            <a href="${inviteUrl}" style="display: inline-block; background: #c8522a; color: #f5f4f0; text-decoration: none; font-size: 14px; font-weight: 600; padding: 14px 28px; border-radius: 8px;">
              Accept invitation →
            </a>
            <p style="font-size: 12px; color: #444; margin-top: 24px;">
              This invitation expires in 7 days. If you didn't expect this, you can ignore this email.
            </p>
          </div>
        </div>
      `,
    })
  } catch (err) {
    console.error('Invite email failed:', err)
  }

  return NextResponse.json({ member })
}
