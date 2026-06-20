'use client'

import { SignIn } from '@clerk/nextjs'
import { signInAppearance } from '@/lib/auth/clerkAppearance'
import AuthClerkMount from '@/components/auth/AuthClerkMount'

export default function AuthSignInForm() {
  return (
    <AuthClerkMount>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
        appearance={signInAppearance}
      />
    </AuthClerkMount>
  )
}
