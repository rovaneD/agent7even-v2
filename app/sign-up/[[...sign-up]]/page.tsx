import AuthMarketingShell from '@/components/auth/AuthMarketingShell'
import AuthSignUpForm from '@/components/auth/AuthSignUpForm'

const VALID_PLANS = new Set(['starter', 'growth', 'proagent'])

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; annual?: string }>
}) {
  const { plan, annual } = await searchParams
  const foundationParams = new URLSearchParams()
  if (plan && VALID_PLANS.has(plan)) foundationParams.set('plan', plan)
  if (annual === 'true') foundationParams.set('annual', 'true')
  const redirectUrl = foundationParams.size > 0
    ? `/foundation?${foundationParams.toString()}`
    : '/dashboard'

  return (
    <AuthMarketingShell
      variant="sign-up"
      legalText={
        <>
          By creating an account you agree to our{' '}
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
      <AuthSignUpForm redirectUrl={redirectUrl} />
    </AuthMarketingShell>
  )
}
