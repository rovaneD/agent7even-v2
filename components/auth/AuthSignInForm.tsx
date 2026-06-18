'use client'

import { SignIn } from '@clerk/nextjs'
import { signInAppearance } from '@/lib/auth/clerkAppearance'

export default function AuthSignInForm() {
  return (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/dashboard"
      appearance={signInAppearance}
    />
  )
}
