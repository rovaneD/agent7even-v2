export interface AgentStackItem {
  name: string
  role: string
}

export interface UseCase {
  slug: string
  label: string
  accent: string
  hero: { headline: string; subhead: string }
  painLine: string
  agentStackHeadline: string
  agentStack: AgentStackItem[]
  setup: string
  costHeadline: string
  cost: string
  whatHeadline: string
  what: string
  bullets: { heading: string; body: string }[]
  proofLabels: string[]
  where: string
}

export const cases: UseCase[] = [
  {
    slug: 'local-service',
    label: 'Local service businesses',
    accent: '#10B981',
    hero: {
      headline: 'Good at the work. Now visible for it.',
      subhead:
        "You're good at the work — the cut, the repair, the treatment, the build. The marketing is the part nobody trained you for, and it's the part that fills the calendar. How Maya keeps you visible so you can stay heads-down on the job.",
    },
    painLine: "The competitor across town isn't better. They're just more present.",
    agentStackHeadline: 'The agents local businesses lean on most',
    agentStack: [
      { name: 'SEO Scanner', role: 'Scans your site and flags on-page fixes matched to your market' },
      { name: 'Competitor Watcher', role: 'Weekly competitive reports from your Foundation — not a live feed' },
      { name: 'Content Posting', role: 'Drafts promos, posts, and weekly plans — queued for your approval' },
      { name: 'Performance Digest', role: 'Plain-English read on reach and engagement from connected accounts' },
    ],
    setup:
      "A service business runs on the job in front of you. The client in the chair, the house you're quoting, the appointment running long. You can't market and serve at the same time — and serving always wins, as it should.\n\nSo marketing happens at 9pm, or it doesn't happen.\n\nEvery owner we talk to fights the same battle: the customers come from being seen — the post that shows your work, the promo for the slow week, the SEO fix you never get to — and being seen is the work you never have time for.",
    costHeadline: 'The cost of being invisible',
    cost:
      "The competitor across town isn't better than you. They're just more present — the seasonal offer, the before-and-after, the steady cadence on search and social. When someone looks, they're the obvious choice. You were busy doing great work nobody saw.\n\nEvery quiet week is bookings that went somewhere else. You never see the customer who chose the business that showed up.",
    whatHeadline: 'What Maya handles for local service',
    what:
      'Tell Maya you want to fill next week — she drafts the offer and the posts to push it, in your voice, ready to approve. **SEO Scanner** flags quick wins on your site. **Competitor Watcher** delivers weekly competitive reports grounded in what you&rsquo;ve told us — actionable briefings, not live monitoring. **Performance Digest** turns connected analytics into a plain-English read on what&rsquo;s working.\n\nYou stay in control. Nothing goes live until you approve it. Maya drafts; you publish when you&rsquo;re ready.',
    bullets: [
      {
        heading: 'A slow week becomes a promotion overnight.',
        body: 'Tell Maya the gap; get the offer and posts to fill it — review, approve, then publish in a click.',
      },
      {
        heading: "You're never the last to know.",
        body: 'Competitive reports from your Foundation — so you see rival moves before they cost you a week.',
      },
      {
        heading: 'Visibility without the 9pm grind.',
        body: 'SEO notes, content drafts, and performance summaries — surfaced when you have a minute, not when you should be off the clock.',
      },
      {
        heading: 'One voice, everywhere you show up.',
        body: 'Maya learns your business once and sounds like you across every post and page.',
      },
    ],
    proofLabels: ['Overnight', 'Never last to know', 'Off the clock', 'One voice'],
    where:
      "In one conversation. You direct in plain language; specialist agents draft and report — marketing that runs while you're on the job, not after it. You stop being invisible on your busy weeks.",
  },
  {
    slug: 'ecommerce',
    label: 'E-commerce brands',
    accent: '#EE533B',
    hero: {
      headline: "The store runs.\nThe brand doesn't have to stop.",
      subhead:
        'You can build the store, source the product, and nail the photos. Then the marketing has to run every single day — and you only have so many days in you. How Maya keeps the brand moving between drops.',
    },
    painLine: 'The brand goes quiet between launches — and quiet trains customers to forget.',
    agentStackHeadline: 'The agents e-commerce brands lean on most',
    agentStack: [
      { name: 'Campaign Builder', role: 'Full launch plans — strategy, email copy, posts, ad variations, timeline' },
      { name: 'Content Posting', role: 'On-brand images, short video, and captions — approval before anything queues' },
      { name: 'Weekly Content', role: 'A week of posts and emails drafted in one session' },
      { name: 'Competitor Watcher', role: 'Competitive reports so you\'re not blindsided by a rival sale' },
    ],
    setup:
      "Running a store is relentless. Inventory, fulfillment, the support ticket that needs an answer before the customer leaves a one-star review. The work that screams loudest gets done.\n\nMarketing never screams. It just quietly underperforms.\n\nEvery founder we talk to fights the same battle: the brand needs a constant presence — emails, posts, the next drop teased — and presence is exactly what runs out first.",
    costHeadline: 'The cost of going quiet',
    cost:
      "A brand that posts in bursts trains customers to forget it. The list you don't email is a list you're slowly losing. The launch you under-promote is visibility you'll never get back.\n\nConsistency isn't the boring part of e-commerce. It's the whole game. And it's the first thing to go when you're running the store.",
    whatHeadline: 'What Maya handles for e-commerce',
    what:
      'Tell Maya about the drop — **Campaign Builder** returns the launch sequence: teasers, emails, posts, ad variations to test. **Content Posting** generates images in your brand style, short-form video, and captions that read what&rsquo;s in the frame. **Competitor Watcher** delivers competitive reports so you know what rivals are running. Media-heavy brands on **ProAgent** unlock premium image and video models when quality matters most.\n\nYou stay in control. Nothing goes live until you sign off — then you publish or schedule in a click.',
    bullets: [
      {
        heading: 'A drop becomes a campaign in an afternoon.',
        body: 'Tell Maya the product; get the full launch sequence built around your brand — review, approve, then publish.',
      },
      {
        heading: "You're never undercut blind.",
        body: 'Competitive reports from your Foundation — flagged before a rival promo eats your weekend.',
      },
      {
        heading: 'Media that matches the product.',
        body: 'On-brand images and short video generated for posts — not generic stock pasted on your feed.',
      },
      {
        heading: 'One voice, every channel.',
        body: 'Maya learns your brand once and holds it across email, social, and the site.',
      },
    ],
    proofLabels: ['In an afternoon', 'Never blindsided', 'On-brand media', 'Held everywhere'],
    where:
      'In one conversation. You direct in plain language; specialist agents plan, draft, and generate — the always-on marketing layer a growing brand needs, without the headcount. The store stops going quiet between launches.',
  },
  {
    slug: 'coaches-creators',
    label: 'Coaches, creators & solo founders',
    accent: '#F5349B',
    hero: {
      headline: 'Finally in two places at once.',
      subhead:
        'You are the product, the brand, and the marketing department — all in one person, with the same twenty-four hours as everyone else. How Maya carries the marketing so you can do the thing only you can do.',
    },
    painLine: "You can't scale yourself. That's the real ceiling.",
    agentStackHeadline: 'The agents creators lean on most',
    agentStack: [
      { name: 'Weekly Content', role: 'Cadence plans — a week of posts and emails in one approval session' },
      { name: 'Content Posting', role: 'Image-aware captions, on-brand images, and short video' },
      { name: 'Trend Spotter', role: 'Trend reports for your niche — filtered for brand fit, not live monitoring' },
      { name: 'Campaign Builder', role: 'Launch and offer pushes — emails, posts, ad variations to test' },
    ],
    setup:
      "When you're a team of one, every hour is a trade. An hour writing the email is an hour not coaching, not creating, not building the thing people actually pay for. The marketing competes directly with the work — and the work always feels more urgent.\n\nSo the marketing gets the leftover hours. Usually there aren't any.\n\nEvery solo operator we talk to fights the same battle: the audience grows by showing up consistently — and showing up consistently is a full-time job stacked on top of your full-time job.",
    costHeadline: 'The cost of doing it all yourself',
    cost:
      "Going solo means the marketing is always the first thing to drop. A week heads-down on client work is a week your audience hears nothing. The launch you under-promote because you ran out of steam is the launch that quietly underperforms.\n\nYou can't scale yourself. That's the real ceiling — not your ideas, your hours.",
    whatHeadline: 'What Maya handles for creators',
    what:
      'Tell Maya about the offer — **Campaign Builder** drafts the launch: emails, posts, ad variations to test. **Weekly Content** plans your cadence in one session. **Trend Spotter** delivers trend reports worth weighing in on. **Content Posting** generates images, short video, and captions that match what&rsquo;s in the frame.\n\nYou stay in control. Nothing goes out until you approve it. Maya drafts; you publish when you&rsquo;re ready.',
    bullets: [
      {
        heading: 'Consistency without the content treadmill.',
        body: 'A week of posts and emails drafted in your voice — one approval session, not seven late nights.',
      },
      {
        heading: "You're never late to the conversation.",
        body: 'Trend reports for your niche — filtered for fit before anything reaches your queue.',
      },
      {
        heading: 'Media that still sounds like you.',
        body: 'On-brand images, video, and captions — generated and queued, not auto-posted.',
      },
      {
        heading: 'Launches when you\'re slammed.',
        body: 'Full offer sequences drafted while you deliver — review when you surface, not when you should be off.',
      },
    ],
    proofLabels: ['One session', 'Never late', 'Still you', 'While you deliver'],
    where:
      'In one conversation. You direct in plain language; specialist agents draft and generate — the marketing capacity you can\'t hire and can\'t skip. You stop trading the work for the marketing.',
  },
  {
    slug: 'startups',
    label: 'Startups & early-stage teams',
    accent: '#6366F1',
    hero: {
      headline: 'Ship the story before\nyou ship the team.',
      subhead:
        'You are product, sales, and the entire marketing department — often before you can hire any of them. How Maya turns one Foundation into launch-ready campaigns while you stay focused on building.',
    },
    painLine: "You can't hire marketing yet — but you still have to look like you did.",
    agentStackHeadline: 'The agents early-stage teams lean on most',
    agentStack: [
      { name: 'Campaign Builder', role: 'Launch plans from one brief — positioning, emails, posts, ad variations to test' },
      { name: 'Idea Analysis', role: 'Breaks one wedge into angles for hooks, landing copy, and GTM tests' },
      { name: 'Content Posting', role: 'Launch posts, on-brand images, and short video — queued for approval' },
      { name: 'Performance Digest', role: 'Plain-English read on reach and traffic once analytics connect' },
    ],
    setup:
      "Early-stage teams run on runway and focus. Every hour on a launch email is an hour not on the product, a pilot customer, or the deck that closes the next check. Marketing can't wait for a hire — but it also can't be wrong.\n\nSo founders patch it together: a post when they remember, a landing page that ages, a launch that under-promotes because the team ran out of steam.\n\nEvery startup we talk to hits the same wall: you need to look established before you are — without pretending you already have a marketing department.",
    costHeadline: 'The cost of looking early',
    cost:
      "Investors, early customers, and partners judge momentum from the outside. A quiet month reads like a stalled company. A launch that lands in one channel and nowhere else reads like a side project.\n\nYou don't need a full team yet — you need a credible GTM motion. That's the gap between 'interesting idea' and 'company taking itself seriously.'",
    whatHeadline: 'What Maya handles for startups',
    what:
      'Tell Maya the launch — **Campaign Builder** drafts the sequence: positioning, emails, social posts, ad variations to test. **Idea Analysis** pressure-tests angles from your Foundation before you commit. **Content Posting** generates launch posts, images, and short video in your voice. **Performance Digest** summarizes what moved once GA and social are connected.\n\nYou stay in control. Nothing publishes until you approve it. One Foundation, one brand — built for a team of one (or five) until multi-workspace agency tooling ships separately.',
    bullets: [
      {
        heading: 'A launch plan from one conversation.',
        body: 'Brief Maya on the release; get emails, posts, and ad variations drafted — review, approve, then publish when you are ready.',
      },
      {
        heading: 'GTM angles before you burn runway.',
        body: 'Idea Analysis turns one wedge into structured hooks and campaign directions — not generic startup fluff.',
      },
      {
        heading: 'Launch creative without a designer on payroll.',
        body: 'On-brand images, short video, and captions — generated and queued, not auto-posted.',
      },
      {
        heading: 'Signal, not vanity metrics.',
        body: 'Performance Digest reads connected analytics in plain English — engagement and traffic, not revenue attribution you do not have wired yet.',
      },
    ],
    proofLabels: ['One brief', 'Before burn', 'No designer', 'Plain signal'],
    where:
      'In one conversation while the team is still small. You direct in plain language; specialist agents draft the GTM layer you cannot hire yet — without faking a multi-client agency workspace the product does not run today.',
  },
]
