import type { Metadata } from 'next'
import { privateRouteMetadata } from '@/lib/marketing/seoMetadata'

export const metadata: Metadata = privateRouteMetadata('Sign in | Agent7even')

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children
}
