import { CANONICAL_SITE_URL } from '@/lib/siteUrls'
import { canonicalUrl } from '@/lib/marketing/seoMetadata'

type Props = {
  title: string
  description: string
  slug: string
  date: string
}

export default function BlogPostJsonLd({ title, description, slug, date }: Props) {
  const url = canonicalUrl(`/blog/${slug}`)
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: title,
        description,
        datePublished: date,
        author: {
          '@type': 'Organization',
          name: 'Agent7even',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Agent7even',
          logo: {
            '@type': 'ImageObject',
            url: `${CANONICAL_SITE_URL}/agent7even_logo.svg`,
          },
        },
        mainEntityOfPage: url,
        url,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: CANONICAL_SITE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Blog',
            item: canonicalUrl('/blog'),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: title,
            item: url,
          },
        ],
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
