import { CANONICAL_SITE_URL } from '@/lib/siteUrls'

export default function MarketingJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Agent7even',
        url: CANONICAL_SITE_URL,
        logo: `${CANONICAL_SITE_URL}/agent7even_logo.svg`,
        description:
          'AI marketing operating system for small business — campaigns, content, and specialist agents coordinated by Maya.',
        areaServed: {
          '@type': 'Country',
          name: 'United States',
        },
        knowsAbout: [
          'AI marketing automation',
          'small business marketing',
          'marketing operating system',
        ],
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Agent7even',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: CANONICAL_SITE_URL,
        description:
          'AI marketing OS for small business — Maya coordinates twelve specialist agents for campaigns, content, SEO, and ads with approval-first workflows.',
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: '49',
          highPrice: '149',
          priceCurrency: 'USD',
          offerCount: 3,
          url: `${CANONICAL_SITE_URL}/pricing`,
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
