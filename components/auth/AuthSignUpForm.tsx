'use client'

import { SignUp } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { signUpAppearance } from '@/lib/auth/clerkAppearance'
import AuthClerkMount from '@/components/auth/AuthClerkMount'
import { trackEvent } from '@/lib/gtag'

type Props = { redirectUrl: string }

export default function AuthSignUpForm({ redirectUrl }: Props) {
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite_token')
  const plan = searchParams.get('plan')
  const annual = searchParams.get('annual') === 'true'
  const trackedPageView = useRef(false)
  const checkoutRedirect = plan
    ? `/checkout-now?plan=${encodeURIComponent(plan)}${annual ? '&annual=true' : ''}`
    : '/start-trial'
  const resolvedRedirect = inviteToken ? '/dashboard?team_joined=true' : checkoutRedirect

  useEffect(() => {
    if (trackedPageView.current) return
    trackedPageView.current = true
    trackEvent('signup_page_view', {
      ...(plan ? { plan } : {}),
      ...(inviteToken ? { invite: true } : {}),
    })
  }, [plan, inviteToken])

  return (
    <AuthClerkMount>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl={resolvedRedirect}
        appearance={signUpAppearance}
      />
    </AuthClerkMount>
  )
}
