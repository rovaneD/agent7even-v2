import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import {
  activateSubscriptionFromCheckoutSession,
  recoverPaidSubscriptionForClerkUser,
} from '@/lib/billing/activateCheckoutSession'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'

/** Client poll after Stripe success redirect — activates subscription without waiting for webhook. */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await req.json()
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  let result = await activateSubscriptionFromCheckoutSession(sessionId, userId)
  if (!result.ok) {
    const email = await getClerkSessionEmail()
    result = (await recoverPaidSubscriptionForClerkUser(userId, email)) ?? result
  }
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 409 })
  }

  return NextResponse.json({
    ok: true,
    plan: result.plan,
    redirect: `/foundation?plan=${encodeURIComponent(result.plan)}`,
  })
}
