import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'
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

  const { email, role, permissions } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, plan, stripe_subscription_id, is_account_owner')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (!profile.is_account_owner) return NextResponse.json({ error: 'Only account owners can invite members' }, { status: 403 })

  // Check if already invited (allow re-invite after removal)
  const { data: existing } = await supabase
    .from('team_members')
    .select('id, status')
    .eq('account_id', profile.id)
    .eq('invited_email', email.toLowerCase())
    .maybeSingle()

  if (existing && existing.status !== 'removed') {
    return NextResponse.json({ error: 'This email has already been invited' }, { status: 400 })
  }

  // Count current members
  const { count: currentMembers } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', profile.id)
    .neq('status', 'removed')

  const includedSeats = PLAN_SEAT_LIMITS[profile.plan ?? ''] ?? 1
  const usedSeats = (currentMembers ?? 0) + 1 // +1 for owner
  const needsExtraSeat = usedSeats >= includedSeats

  // Add extra seat to Stripe subscription if needed
  if (needsExtraSeat && profile.stripe_subscription_id) {
    try {
      const stripe = getStripeClient()
      if (!stripe) throw new Error('Billing is not configured')

      const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
      const existingSeatItem = subscription.items.data.find(
        item => item.price.id === process.env.STRIPE_SEAT_PRICE_ID
      )

      if (existingSeatItem) {
        // Increment existing seat quantity
        await stripe.subscriptionItems.update(existingSeatItem.id, {
          quantity: (existingSeatItem.quantity ?? 1) + 1,
        })
      } else {
        // Add new seat line item
        await stripe.subscriptionItems.create({
          subscription: profile.stripe_subscription_id,
          price: process.env.STRIPE_SEAT_PRICE_ID!,
          quantity: 1,
        })
      }
    } catch (err) {
      console.error('Stripe seat add error:', err)
      return NextResponse.json({ error: 'Failed to add seat to subscription. Please check your billing.' }, { status: 500 })
    }
  }

  // Generate invite token
  const inviteToken = randomUUID()

  // Create or reactivate team member record
  const memberPayload = {
    role: role ?? 'member',
    permissions: permissions ?? {},
    status: 'pending',
    invited_email: email.toLowerCase(),
    invite_token: inviteToken,
    member_profile_id: null,
  }

  const memberResult = existing?.status === 'removed'
    ? await supabase
        .from('team_members')
        .update(memberPayload)
        .eq('id', existing.id)
        .select()
        .single()
    : await supabase
        .from('team_members')
        .insert({
          account_id: profile.id,
          ...memberPayload,
        })
        .select()
        .single()

  const { data: member, error } = memberResult

  if (error) {
    console.error('Team member insert error:', error)
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }

  // Send invite email
  try {
    await sendTransactionalEmail({
      to: email,
      subject: `You've been invited to join ${profile.company_name ?? 'a team'} on Agent7even`,
      title: "You've been invited",
      body: `${profile.company_name ?? 'Your team'} has invited you to join their Agent7even dashboard.\n\nThis invitation expires in 7 days. If you did not expect this, you can ignore this email.`,
      link: `/api/team/accept?token=${inviteToken}`,
      ctaLabel: 'Accept invitation →',
    })
  } catch (err) {
    console.error('Invite email failed:', err)
  }

  const safeMember = { ...(member as Record<string, unknown>) }
  delete safeMember.invite_token
  return NextResponse.json({ member: safeMember })
}
