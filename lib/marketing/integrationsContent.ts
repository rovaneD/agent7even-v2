export type IntegrationItem = {
  name: string
  detail: string
}

export type IntegrationCategory = {
  title: string
  intro: string
  items: IntegrationItem[]
}

/** Factual integrations supported today — matches product capability ledger. */
export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  {
    title: 'Social publishing',
    intro: 'Connect accounts in Settings to draft, schedule, and publish approved posts.',
    items: [
      { name: 'Instagram', detail: 'Connect and publish approved posts via connected social accounts.' },
      { name: 'Facebook', detail: 'Page publishing when your account is connected.' },
      { name: 'LinkedIn', detail: 'Profile and page publishing for approved content.' },
      { name: 'Threads', detail: 'Publish approved posts to connected Threads accounts.' },
      { name: 'YouTube', detail: 'Connect for publishing approved video content.' },
      {
        name: 'X (Twitter)',
        detail: 'Connect on Growth or ProAgent plans. Starter can still draft posts for any platform.',
      },
    ],
  },
  {
    title: 'Analytics',
    intro: 'Connect once — Performance Digest and Analytics read connected data in plain English.',
    items: [
      {
        name: 'Google Analytics (GA4)',
        detail: 'OAuth connect for traffic, channel, and engagement reporting inside the app.',
      },
    ],
  },
  {
    title: 'Email & CRM',
    intro: 'Maya drafts sequences and campaigns — you paste or sync through your existing stack.',
    items: [
      {
        name: 'Mailchimp, Klaviyo, and other ESPs',
        detail: 'Email sequences and newsletters are drafted for you to copy into your email provider.',
      },
      {
        name: 'Your CRM',
        detail: 'Foundation captures your business context; export drafts and copy into HubSpot, spreadsheets, or your CRM of choice.',
      },
    ],
  },
]
