import type { Metadata } from 'next'
import { Instrument_Serif, Inter } from 'next/font/google'
import VoixLanding from './VoixLanding'

const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--voix-serif',
})

const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--voix-sans',
})

export const metadata: Metadata = {
  title: 'Voix by Agent7even — the AI front desk for med spas',
  description:
    'Voix is the AI receptionist for med spas. It answers after hours, between clients and on busy days, and books consultations straight into your schedule.',
  alternates: { canonical: '/voix' },
  openGraph: {
    title: 'Voix by Agent7even — the AI front desk for med spas',
    description: 'Every call answered. Every consult booked. Try Voix free for 14 days.',
    url: '/voix',
    images: ['/voix/call-1.jpg'],
  },
}

export default function VoixPage() {
  return (
    <div className={`${serif.variable} ${sans.variable}`}>
      <VoixLanding />
    </div>
  )
}
