export type BlogProductCta = {
  headline: string
  body: string
}

/** Maps legacy blog `service` frontmatter to accurate Agent7even product copy. */
const BLOG_PRODUCT_CTA_BY_SERVICE: Record<string, BlogProductCta> = {
  'Ad Management': {
    headline: 'Ad Variations agent',
    body:
      'Maya drafts ad headlines and copy variations for you to test in Meta Ads Manager — you approve every draft first. Agent7even does not run, manage, or place ads for you.',
  },
  'Social Media Management': {
    headline: 'Content Posting & Weekly Content',
    body:
      'Maya drafts posts, captions, and weekly content plans in your Brand Kit voice — queued for your approval before you publish or schedule.',
  },
  'Product Photography': {
    headline: 'On-brand image generation',
    body:
      'Generate post images and creative in your brand style inside the platform — not a photography shoot or design agency service.',
  },
  'SEO Basics': {
    headline: 'SEO Scanner agent',
    body:
      'The SEO Scanner reads your live pages and flags title, meta, and content fixes grounded in your Foundation — not a full agency crawl or ongoing SEO management.',
  },
  'Brand Identity & Logo': {
    headline: 'Brand Kit & Foundation',
    body:
      'Complete Brand Kit once so Maya and every agent draft in your voice — Agent7even does not design logos or brand identity packages for you.',
  },
  'AI Toolkit': {
    headline: 'Maya + specialist agents',
    body:
      'Run agents from the Command Center or chat with Maya — campaigns, content, creative, and email drafts land in your approval queue before anything goes live.',
  },
  'Email Marketing Setup': {
    headline: 'Email Sequence Builder',
    body:
      'Maya drafts email sequences in your voice for you to paste into Mailchimp, Klaviyo, or your ESP — Agent7even does not send campaigns on your behalf.',
  },
  'Website Building': {
    headline: 'SEO Scanner + campaign drafts',
    body:
      'Fix on-page copy and messaging with the SEO Scanner and Campaign Builder — Agent7even does not build or host websites for you.',
  },
}

const DEFAULT_CTA: BlogProductCta = {
  headline: 'Maya + specialist agents',
  body:
    'Draft campaigns, content, and creative in your voice — everything queues for your approval before you publish.',
}

export function getBlogProductCta(service: string): BlogProductCta {
  return BLOG_PRODUCT_CTA_BY_SERVICE[service] ?? DEFAULT_CTA
}
