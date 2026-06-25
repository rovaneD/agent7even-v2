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
      headline: "The store runs. The brand doesn't have to stop.",
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
      'Tell Maya about the drop — **Campaign Builder** returns the launch sequence: teasers, emails, posts, ad variations to test. **Content Posting** generates images in your brand style, short-form video, and captions that read what&rsquo;s in the frame. **Competitor Watcher** delivers competitive reports so you know what rivals are running.\n\nYou stay in control. Nothing goes live until you sign off — then you publish or schedule in a click.',
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
    slug: 'agencies',
    label: 'Agencies',
    accent: '#3286FE',
    hero: {
      headline: 'Your team back on the work that justifies the rate.',
      subhead:
        'Your team does creative work — strategy, content, campaigns that actually land. But a chunk of every week disappears into execution that doesn\'t touch the creative. How Maya adds production capacity — not another client portal.',
    },
    painLine: 'Your best people get pulled into work that just has to get done.',
    agentStackHeadline: 'The agents agencies lean on most',
    agentStack: [
      { name: 'Campaign Builder', role: 'Multi-asset campaign plans from one brief — ready for senior review' },
      { name: 'Email Sequence Builder', role: 'Full email flows drafted to load into any ESP' },
      { name: 'Ad Variations', role: 'Headlines, body, and CTAs to test — not live ad campaigns' },
      { name: 'Approval queue', role: 'Nothing reaches a client until your team signs off' },
    ],
    setup:
      "Agency work is creative work. The strategy, the concept, the campaign that moves a client's numbers. That's what you sell, and that's where your margin lives.\n\nThe production grind is not where your margin lives.\n\nEvery agency owner we talk to fights the same battle: the high-value thinking competes for hours against the high-volume doing — caption variants, email drafts, ad copy blocks. Your best people get pulled out of the work that matters to do the work that just has to get done.",
    costHeadline: 'The cost of the production drag',
    cost:
      'Talent burns out on volume, not on hard problems. When senior creatives spend their week on rote execution, the strategic work gets thinner, clients feel it, and accounts get shaky. You\'re paying expert rates for assembly-line hours — and the math gets worse with every account you add.\n\nIt doesn\'t scale. Growth just means more volume crushing the same people.',
    whatHeadline: 'What Maya handles for agencies',
    what:
      'Brief Maya on a client — **Campaign Builder**, **Email Sequence Builder**, and **Ad Variations** return drafts in that client\'s voice, routed to your **approval queue**. Your team reviews, refines, and sends — Maya handles the volume of writing and variation, not client management or white-label workspaces.\n\nYour team stays in control. Everything routes through them before it reaches a client. Maya adds production capacity; your experts do the thinking.',
    bullets: [
      {
        heading: 'Campaigns drafted from a brief, not a blank page.',
        body: 'Strategy, email flows, social copy, and ad variations — your team edits instead of building from zero.',
      },
      {
        heading: 'Volume without the assembly line.',
        body: 'More drafts per week from the same headcount — approval-first, so quality stays with your team.',
      },
      {
        heading: 'Competitive intel without the manual research.',
        body: 'Competitor Watcher reports you can fold into client strategy — grounded briefings, not live feeds.',
      },
      {
        heading: 'Voice held per brief.',
        body: 'Maya matches each client\'s Brand Kit — your team approves before anything goes out.',
      },
    ],
    proofLabels: ['From a brief', 'Same headcount', 'No manual research', 'Team-approved'],
    where:
      'Behind your team as production capacity — not a multi-client platform you don\'t have yet. You stay the strategist and the face; Maya drafts at volume so your people get back to the work clients actually pay for.',
  },
]
