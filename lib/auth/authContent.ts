import { BookOpen, Bot, ShieldCheck, type LucideIcon } from 'lucide-react'
import { TRIAL_LABEL } from '@/lib/billing/trialPolicy'

export type AuthHighlight = {
  icon: LucideIcon
  label: string
  desc: string
  iconClass: string
  bgClass: string
}

export const AUTH_HIGHLIGHTS: AuthHighlight[] = [
  {
    icon: BookOpen,
    label: 'Foundation once',
    desc: 'Your business, audience, and voice, saved once and read by every agent before drafting.',
    iconClass: 'text-[#F5349B]',
    bgClass: 'bg-[#F5349B]/10',
  },
  {
    icon: Bot,
    label: 'Twelve specialist agents',
    desc: 'Maya coordinates campaigns, content, email, creative, and reports from one place.',
    iconClass: 'text-[#3286FE]',
    bgClass: 'bg-[#3286FE]/10',
  },
  {
    icon: ShieldCheck,
    label: 'One approval queue',
    desc: 'Every draft waits for your sign-off. Nothing publishes until you approve.',
    iconClass: 'text-[#10B981]',
    bgClass: 'bg-[#10B981]/10',
  },
]

export const AUTH_VARIANTS = {
  'sign-in': {
    eyebrow: 'Your marketing command center',
  },
  'sign-up': {
    eyebrow: TRIAL_LABEL,
  },
} as const
