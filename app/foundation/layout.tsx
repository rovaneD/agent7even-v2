import type { Metadata } from 'next'
import { privateRouteMetadata } from '@/lib/marketing/seoMetadata'

export const metadata: Metadata = privateRouteMetadata('Foundation setup | Agent7even')

export default function FoundationLayout({ children }: { children: React.ReactNode }) {
  return children
}
