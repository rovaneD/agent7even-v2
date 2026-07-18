import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Roboto, Roboto_Mono } from 'next/font/google'
import { clerkLocalization } from '@/lib/auth/clerkLocalization'
import { CANONICAL_SITE_URL } from '@/lib/siteUrls'
import DeferredChrome from '@/components/analytics/DeferredChrome'
import './globals.css'
import { cn } from "@/lib/utils";

/**
 * BEFORE: Google Fonts @import in lab5/styles.css blocked first paint.
 * AFTER: next/font self-hosts Roboto with display:swap across the app.
 * preload: true helps LCP when the hero title uses these faces.
 */
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  preload: true,
  variable: '--l5-font-face',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  preload: false,
  variable: '--l5-mono-face',
})

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
    <html lang="en" className={cn("h-full antialiased", "font-sans", roboto.variable, robotoMono.variable)}>
      <head>
        <meta name="facebook-domain-verification" content="ks9g2iw6wruvyk4rk0u42889264o64" />
        {/* BEFORE: Tabler Icons CSS blocked every page (incl. marketing homepage).
            AFTER: loaded only in dashboard layout — marketing never pays for it. */}
      </head>
      <body className="min-h-full bg-gray-50 text-gray-900">
        <ClerkProvider localization={clerkLocalization}>
          {children}
          <DeferredChrome />
        </ClerkProvider>
      </body>
    </html>
  )
}
