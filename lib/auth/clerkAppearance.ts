const baseVariables = {
  colorPrimary: '#3286FE',
  colorBackground: '#FFFFFF',
  colorInputBackground: '#FFFFFF',
  colorInputText: '#0E0E11',
  colorText: '#0E0E11',
  colorTextSecondary: '#6C7079',
  colorDanger: '#EE533B',
  borderRadius: '12px',
  fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: '0.9375rem',
}

const baseElements = {
  rootBox: 'w-full',
  cardBox: 'w-full shadow-none',
  card: 'shadow-[var(--l5-shadow-card)] border border-[#E8E8EB] rounded-[18px] bg-white w-full',
  headerTitle: 'text-[22px] font-medium tracking-[-0.02em] text-[#0E0E11]',
  headerSubtitle: 'text-[15px] text-[#6C7079]',
  logoBox: 'justify-center mb-2',
  logoImage: 'h-9 w-auto',
  socialButtonsBlockButton:
    'border border-[#E8E8EB] bg-white text-[#0E0E11] hover:bg-[#F9F9FA] font-medium',
  socialButtonsBlockButtonText: 'font-medium',
  dividerLine: 'bg-[#E8E8EB]',
  dividerText: 'text-[#9AA0AA]',
  formFieldLabel: 'text-[#3A3D44] font-medium',
  formFieldInput:
    'border-[#E8E8EB] focus:border-[#3286FE] focus:ring-2 focus:ring-[#3286FE]/20 rounded-xl',
  formButtonPrimary:
    '!bg-[#0E0E11] hover:!bg-black !text-white font-medium rounded-[10px] shadow-none',
  footerActionLink: '!text-[#3286FE] hover:!text-[#1F6FEB] font-medium',
  identityPreviewEditButton: '!text-[#3286FE]',
  footer: 'bg-transparent',
  footerActionText: 'text-[#6C7079]',
  formFieldAction: '!text-[#3286FE]',
  alertText: 'text-[#3A3D44]',
}

export const signInAppearance = {
  variables: baseVariables,
  elements: {
    ...baseElements,
    headerTitle: 'Welcome back',
    headerSubtitle: 'Sign in to your Agent7even account',
  },
  layout: {
    logoImageUrl: '/agent7even_logo.svg',
    socialButtonsPlacement: 'top',
  },
}

export const signUpAppearance = {
  variables: baseVariables,
  elements: {
    ...baseElements,
    headerTitle: 'Create your account',
    headerSubtitle: 'Start your 3-day free trial on Starter',
  },
  layout: {
    logoImageUrl: '/agent7even_logo.svg',
    socialButtonsPlacement: 'top',
  },
}
