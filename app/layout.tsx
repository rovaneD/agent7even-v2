import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { clerkLocalization } from '@/lib/auth/clerkLocalization'
import { CANONICAL_SITE_URL } from '@/lib/siteUrls'
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
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-8913QV8Z1M" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-8913QV8Z1M');
        `}</Script>
      </head>
      <body className="min-h-full bg-gray-50 text-gray-900">
        <ClerkProvider localization={clerkLocalization}>
          {children}
        </ClerkProvider>
        <Analytics />
      </body>
    </html>
  )
}
