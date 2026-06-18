'use client'

import { SignUp } from '@clerk/nextjs'
import { signUpAppearance } from '@/lib/auth/clerkAppearance'

type Props = { redirectUrl: string }

export default function AuthSignUpForm({ redirectUrl }: Props) {
  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      forceRedirectUrl={redirectUrl}
      appearance={signUpAppearance}
    />
  )
}
