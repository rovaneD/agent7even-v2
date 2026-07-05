import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getStripeClient } from '@/lib/stripe'

const PLAN_SEAT_LIMITS: Record<string, number> = {
  starter: 1,
  growth: 3,
  proagent: 5,
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { memberId } = await req.json()
  if (!memberId) return NextResponse.json({ error: 'Member ID required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plan, stripe_subscription_id, is_account_owner')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile || !profile.is_account_owner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Verify ownership
  const { data: member } = await supabase
    .from('team_members')
    .select('account_id, member_profile_id, status')
    .eq('id', memberId)
    .single()

  if (!member || member.account_id !== profile.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Count remaining members after removal
  const { count: currentMembers } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', profile.id)
    .neq('status', 'removed')

  const includedSeats = PLAN_SEAT_LIMITS[profile.plan ?? ''] ?? 1
  const remainingAfterRemoval = (currentMembers ?? 1) - 1
  const hadExtraSeat = (currentMembers ?? 0) + 1 > includedSeats

  // Decrement Stripe seat if was paying for extra
  if (hadExtraSeat && profile.stripe_subscription_id) {
    try {
      const stripe = getStripeClient()
      if (!stripe) throw new Error('Billing is not configured')

      const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id)
      const seatItem = subscription.items.data.find(
        item => item.price.id === process.env.STRIPE_SEAT_PRICE_ID
      )

      if (seatItem) {
        const newQuantity = (seatItem.quantity ?? 1) - 1
        if (newQuantity <= 0) {
          // Remove item by setting quantity to 0 via update (delete not available in this API version)
          await stripe.subscriptionItems.update(seatItem.id, { quantity: 1, deleted: true } as any)
        } else {
          await stripe.subscriptionItems.update(seatItem.id, { quantity: newQuantity })
        }
      }
    } catch (err) {
      console.error('Stripe seat remove error:', err)
    }
  }

  // Remove member
  await supabase
    .from('team_members')
    .update({ status: 'removed' })
    .eq('id', memberId)

  // Unlink profile if they had one
  if (member.member_profile_id) {
    await supabase
      .from('profiles')
      .update({
        account_id: null,
        is_account_owner: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', member.member_profile_id)
  }

  return NextResponse.json({ success: true })
}
