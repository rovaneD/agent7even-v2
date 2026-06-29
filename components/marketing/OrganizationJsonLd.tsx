import { CANONICAL_SITE_URL } from '@/lib/siteUrls'

export default function OrganizationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
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
    knowsAbout: ['AI marketing automation', 'small business marketing', 'marketing operating system'],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
