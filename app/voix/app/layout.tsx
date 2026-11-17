import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { voixSans, voixSerif } from '../_components/voixFonts'
import { privateRouteMetadata } from '@/lib/marketing/seoMetadata'

export const metadata: Metadata = privateRouteMetadata('Voix')

export default function VoixAppLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${voixSerif.variable} ${voixSans.variable} min-h-screen bg-[#F6F7F9] text-[#1B2236] antialiased`}
      style={{ fontFamily: 'var(--voix-sans), system-ui, sans-serif' }}
    >
      {children}
    </div>
  )
}
