import { Instrument_Serif, Inter } from 'next/font/google'

export const voixSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--voix-serif',
})

export const voixSans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--voix-sans',
})
