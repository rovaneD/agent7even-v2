import AuthMarketingShell from '@/components/auth/AuthMarketingShell'
import AuthSignUpForm from '@/components/auth/AuthSignUpForm'

export default function SignUpPage() {
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
      <AuthSignUpForm redirectUrl="/dashboard" />
    </AuthMarketingShell>
  )
}
