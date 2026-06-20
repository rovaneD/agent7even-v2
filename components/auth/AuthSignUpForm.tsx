'use client'

import { SignUp } from '@clerk/nextjs'
import { signUpAppearance } from '@/lib/auth/clerkAppearance'
import AuthClerkMount from '@/components/auth/AuthClerkMount'

type Props = { redirectUrl: string }

export default function AuthSignUpForm({ redirectUrl }: Props) {
  return (
    <AuthClerkMount>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl={redirectUrl}
        appearance={signUpAppearance}
      />
    </AuthClerkMount>
  )
}
