import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import Script from 'next/script'
import './globals.css'
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: 'Agent7even App',
  description: 'Your marketing command center',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans")}>
      <head>
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
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
