import type { Metadata } from 'next'
import AuthMarketingShell from '@/components/auth/AuthMarketingShell'
import AuthSignInForm from '@/components/auth/AuthSignInForm'
import { privateRouteMetadata } from '@/lib/marketing/seoMetadata'

export const metadata: Metadata = privateRouteMetadata('Sign in — Agent7even')

export default function SignInPage() {
  return (
    <AuthMarketingShell
      variant="sign-in"
      legalText={
        <>
          By signing in you agree to our{' '}
          <a href="/terms" className="underline underline-offset-2 hover:text-[#6C7079]">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline underline-offset-2 hover:text-[#6C7079]">
            Privacy Policy
          </a>
          .
        </>
      }
    >
      <AuthSignInForm />
    </AuthMarketingShell>
  )
}
