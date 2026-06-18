import { SignUp } from '@clerk/nextjs'
import AuthMarketingShell from '@/components/auth/AuthMarketingShell'
import { signUpAppearance } from '@/lib/auth/clerkAppearance'

type Props = { searchParams: Promise<{ plan?: string }> }

const highlights = [
  { label: '3-day free trial on Starter', desc: 'Card collected upfront — no charge until day 4.' },
  { label: 'Foundation in minutes', desc: 'Tell Maya about your business and unlock the workspace.' },
  { label: 'Cancel anytime', desc: 'No contracts. Upgrade, downgrade, or cancel from billing.' },
]

export default async function SignUpPage({ searchParams }: Props) {
  const { plan } = await searchParams
  const postSignUpRedirect = plan ? `/foundation?plan=${encodeURIComponent(plan)}` : '/foundation'

  return (
    <AuthMarketingShell
      eyebrow="Get started"
      title={<>Start your free trial</>}
      lead="Meet Maya — the marketing team that never clocks out. Plans from $49/mo after trial."
      note="Starter: 3-day free trial. No charge until day 4."
      highlights={highlights}
      legalText={
        <>
          By creating an account you agree to our{' '}
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
      <SignUp forceRedirectUrl={postSignUpRedirect} appearance={signUpAppearance} />
    </AuthMarketingShell>
  )
}
