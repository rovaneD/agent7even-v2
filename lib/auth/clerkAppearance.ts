const baseVariables = {
  colorPrimary: '#3286FE',
  colorBackground: '#FFFFFF',
  colorInputBackground: '#FFFFFF',
  colorInputText: '#0E0E11',
  colorText: '#0E0E11',
  colorTextSecondary: '#6C7079',
  borderRadius: '0.75rem',
  fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: '0.9rem',
}

const baseElements = {
  card: 'shadow-xl rounded-2xl bg-white w-full',
  headerTitle: 'text-xl font-semibold text-[#0E0E11]',
  headerSubtitle: 'text-sm text-[#6C7079]',
  logoBox: 'justify-center',
  logoImage: 'h-9 w-auto',
  socialButtonsBlockButton:
    'border border-[#E8E8EB] bg-white text-[#0E0E11] hover:bg-[#F9F9FA] font-medium',
  formFieldLabel: 'text-[#0E0E11] font-semibold text-sm',
  formFieldInput: 'border-[#E8E8EB] rounded-xl',
  formButtonPrimary:
    '!bg-[#2D3748] hover:!bg-[#1a2535] !text-white font-semibold rounded-xl shadow-none',
  footerActionLink: '!text-[#3286FE] hover:!text-[#1F6FEB] font-semibold',
  identityPreviewEditButton: '!text-[#3286FE]',
  footer: 'bg-[#FAFAFA] rounded-b-2xl border-t border-[#F1F1F3]',
  footerActionText: 'text-[#6C7079] text-sm',
}

export const signInAppearance = {
  variables: baseVariables,
  elements: baseElements,
  layout: {
    logoImageUrl: '/agent7even_logo.svg',
    socialButtonsPlacement: 'top',
  },
}

export const signUpAppearance = {
  variables: baseVariables,
  elements: baseElements,
  layout: {
    logoImageUrl: '/agent7even_logo.svg',
    socialButtonsPlacement: 'top',
  },
}
