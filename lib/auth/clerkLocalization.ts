import { FIRST_CHARGE_DAY, TRIAL_LABEL } from '@/lib/billing/trialPolicy'

export const clerkLocalization = {
  signIn: {
    start: {
      title: 'Welcome back',
      subtitle: 'Sign in to your approval queue',
    },
  },
  signUp: {
    start: {
      title: 'Create your account',
      subtitle: `${TRIAL_LABEL} · No charge until day ${FIRST_CHARGE_DAY}`,
    },
  },
}
