import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Analytics } from '@vercel/analytics/next'
import { clerkLocalization } from '@/lib/auth/clerkLocalization'
import { CANONICAL_SITE_URL } from '@/lib/siteUrls'
import ConsentAwareAnalytics from '@/components/analytics/ConsentAwareAnalytics'
import CookieConsentBanner from '@/components/analytics/CookieConsentBanner'
import './globals.css'
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_SITE_URL),
  title: {
    default: 'Agent7even',
    template: '%s',
  },
  description: 'AI marketing operating system for small business — powered by Maya and twelve specialist agents.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans")}>
      <head>
        <meta name="facebook-domain-verification" content="ks9g2iw6wruvyk4rk0u42889264o64" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css" />
      </head>
      <body className="min-h-full bg-gray-50 text-gray-900">
        <ClerkProvider localization={clerkLocalization}>
          {children}
          <CookieConsentBanner />
          <ConsentAwareAnalytics />
          <Analytics />
        </ClerkProvider>
      </body>
    </html>
  )
}
