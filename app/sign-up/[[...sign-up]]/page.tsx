import AuthMarketingShell from '@/components/auth/AuthMarketingShell'
import AuthSignUpForm from '@/components/auth/AuthSignUpForm'

type Props = { searchParams: Promise<{ plan?: string }> }

export default async function SignUpPage({ searchParams }: Props) {
  const { plan } = await searchParams
  const postSignUpRedirect = plan ? `/foundation?plan=${encodeURIComponent(plan)}` : '/foundation'

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
      <AuthSignUpForm redirectUrl={postSignUpRedirect} />
    </AuthMarketingShell>
  )
}
