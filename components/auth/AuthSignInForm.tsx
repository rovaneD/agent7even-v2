'use client'

import { SignIn } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { signInAppearance } from '@/lib/auth/clerkAppearance'
import AuthClerkMount from '@/components/auth/AuthClerkMount'

export default function AuthSignInForm() {
  const searchParams = useSearchParams()
  const requestedRedirect = searchParams.get('redirect_url')
  const safeRedirect = requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
    ? requestedRedirect
    : null

  return (
    <AuthClerkMount>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl={safeRedirect ?? undefined}
        fallbackRedirectUrl="/dashboard"
        appearance={signInAppearance}
      />
    </AuthClerkMount>
  )
}
