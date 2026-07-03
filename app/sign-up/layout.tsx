import type { Metadata } from 'next'
import { privateRouteMetadata } from '@/lib/marketing/seoMetadata'

export const metadata: Metadata = privateRouteMetadata('Sign up | Agent7even')

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children
}
