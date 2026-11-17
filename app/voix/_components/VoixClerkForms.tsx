'use client'

import { SignIn, SignUp } from '@clerk/nextjs'
import AuthClerkMount from '@/components/auth/AuthClerkMount'
import { signInAppearance, signUpAppearance } from '@/lib/auth/clerkAppearance'
import { VOIX_CLERK_PRODUCT } from '@/lib/auth/clerkSignupProduct'

export function VoixSignInForm() {
  return (
    <AuthClerkMount>
      <SignIn
        routing="path"
        path="/voix/sign-in"
        signUpUrl="/voix/sign-up"
        forceRedirectUrl="/voix/app"
        appearance={signInAppearance}
      />
    </AuthClerkMount>
  )
}

export function VoixSignUpForm() {
  return (
    <AuthClerkMount>
      <SignUp
        routing="path"
        path="/voix/sign-up"
        signInUrl="/voix/sign-in"
        forceRedirectUrl="/voix/app"
        unsafeMetadata={{ product: VOIX_CLERK_PRODUCT }}
        appearance={signUpAppearance}
      />
    </AuthClerkMount>
  )
}
