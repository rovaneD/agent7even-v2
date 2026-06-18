import { BarChart2, Layers, Zap, type LucideIcon } from 'lucide-react'

export type AuthHighlight = {
  icon: LucideIcon
  label: string
  desc: string
  iconClass: string
  bgClass: string
}

export const AUTH_HIGHLIGHTS: AuthHighlight[] = [
  {
    icon: Zap,
    label: 'AI Toolkit',
    desc: 'Generate copy, campaigns, and strategy in seconds.',
    iconClass: 'text-[#F5349B]',
    bgClass: 'bg-[#F5349B]/10',
  },
  {
    icon: BarChart2,
    label: 'Live Analytics',
    desc: 'Google Analytics, Instagram, and Meta in one view.',
    iconClass: 'text-[#3286FE]',
    bgClass: 'bg-[#3286FE]/10',
  },
  {
    icon: Layers,
    label: 'Managed Services',
    desc: 'Request work and track deliverables from your team.',
    iconClass: 'text-[#10B981]',
    bgClass: 'bg-[#10B981]/10',
  },
]

export const AUTH_VARIANTS = {
  'sign-in': {
    eyebrow: 'Your marketing command center',
  },
  'sign-up': {
    eyebrow: 'Get started free',
  },
} as const
