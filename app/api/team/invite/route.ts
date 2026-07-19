import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
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

  const profile = await resolveClerkProfile<{
    id: string
    company_name: string | null
    plan: string | null
    billing_exempt: boolean | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    is_account_owner: boolean | null
    created_at: string
  }>(supabase, userId, 'id, company_name, plan, billing_exempt, stripe_subscription_id, is_account_owner')

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

  // Extra seats are billed at $15/mo — an account with no active subscription
  // must not get them for free (comp accounts excepted).
  let seatRollback: (() => Promise<void>) | null = null
  if (needsExtraSeat && !profile.billing_exempt) {
    if (!profile.stripe_subscription_id) {
      return NextResponse.json(
        {
          error: `Your plan includes ${includedSeats} seat${includedSeats === 1 ? '' : 's'}. An active subscription is required to add more.`,
          code: 'SEAT_BILLING_REQUIRED',
        },
        { status: 402 },
      )
    }

    try {
      const stripe = getStripeClient()
      if (!stripe) throw new Error('Billing is not configured')

      const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
      const existingSeatItem = subscription.items.data.find(
        item => item.price.id === process.env.STRIPE_SEAT_PRICE_ID
      )

      if (existingSeatItem) {
        // Increment existing seat quantity
        const previousQuantity = existingSeatItem.quantity ?? 1
        await stripe.subscriptionItems.update(existingSeatItem.id, {
          quantity: previousQuantity + 1,
        })
        seatRollback = async () => {
          await stripe.subscriptionItems.update(existingSeatItem.id, { quantity: previousQuantity })
        }
      } else {
        // Add new seat line item
        const created = await stripe.subscriptionItems.create({
          subscription: profile.stripe_subscription_id,
          price: process.env.STRIPE_SEAT_PRICE_ID!,
          quantity: 1,
        })
        seatRollback = async () => {
          // Same pattern as team/remove — item delete is not exposed in this API version.
          await stripe.subscriptionItems.update(created.id, { quantity: 1, deleted: true } as unknown as Record<string, never>)
        }
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
    // Don't leave the customer paying for a seat the invite never used.
    if (seatRollback) await seatRollback().catch(err => console.error('Seat rollback failed:', err))
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }

  // Send invite email
  try {
    await sendTransactionalEmail({
      to: email,
      subject: `You've been invited to join ${profile.company_name ?? 'a team'} on Agent7even`,
      title: "You've been invited",
      body: `${profile.company_name ?? 'Your team'} has invited you to join their Agent7even dashboard.\n\nThis invitation expires in 7 days. If you did not expect this, you can ignore this email.`,
      link: `/api/team/accept?token=${member.invite_token}`,
      ctaLabel: 'Accept invitation →',
    })
  } catch (err) {
    console.error('Invite email failed:', err)
  }

  return NextResponse.json({ member })
}
