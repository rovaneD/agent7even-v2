import { SignIn } from '@clerk/nextjs'
import AuthMarketingShell from '@/components/auth/AuthMarketingShell'
import { signInAppearance } from '@/lib/auth/clerkAppearance'

const highlights = [
  { label: 'Maya, your AI marketing lead', desc: 'Campaigns, copy, and scheduling in one place.' },
  { label: 'Foundation + Brand Kit', desc: 'Maya learns your voice before anything goes live.' },
  { label: 'Approve before you publish', desc: 'Nothing ships until you sign off.' },
]

export default function SignInPage() {
  return (
    <AuthMarketingShell
      eyebrow="Welcome back"
      title={<>Sign in to Agent7even</>}
      lead="Pick up where you left off — campaigns, agents, analytics, and Maya are ready."
      highlights={highlights}
      legalText={
        <>
          By signing in you agree to our{' '}
          <a href="/terms" className="underline underline-offset-2 hover:text-[var(--l5-muted)]">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline underline-offset-2 hover:text-[var(--l5-muted)]">
            Privacy Policy
          </a>
          .
        </>
      }
    >
      <SignIn fallbackRedirectUrl="/dashboard" appearance={signInAppearance} />
    </AuthMarketingShell>
  )
}
