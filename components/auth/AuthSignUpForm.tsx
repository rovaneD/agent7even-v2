'use client'

import { SignUp } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { signUpAppearance } from '@/lib/auth/clerkAppearance'
import AuthClerkMount from '@/components/auth/AuthClerkMount'

type Props = { redirectUrl: string }

export default function AuthSignUpForm({ redirectUrl }: Props) {
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite_token')
  const resolvedRedirect = inviteToken ? '/dashboard?team_joined=true' : redirectUrl

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
