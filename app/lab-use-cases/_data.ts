export interface UseCase {
  slug: string;
  label: string;
  accent: string;
  hero: { headline: string; subhead: string };
  setup: string;
  costHeadline: string;
  cost: string;
  whatHeadline: string;
  what: string;
  bullets: { heading: string; body: string }[];
  where: string;
}

export const cases: UseCase[] = [
  {
    slug: 'ecommerce',
    label: 'E-commerce brands',
    accent: '#EE533B',
    hero: {
      headline: "The store runs. The brand doesn't have to stop.",
      subhead: "You can build the store, source the product, and nail the photos. Then the marketing has to run every single day — and you only have so many days in you. How Maya keeps the brand moving so you can keep building it.",
    },
    setup: "Running a store is relentless. Inventory, fulfillment, the support ticket that needs an answer before the customer leaves a one-star review. The work that screams loudest gets done.\n\nMarketing never screams. It just quietly underperforms.\n\nEvery founder we talk to fights the same battle: the brand needs a constant presence — emails, posts, the next drop teased, the abandoned cart caught — and presence is exactly what runs out first. You meant to send the campaign. You meant to test the subject line. The day ate it.",
    costHeadline: "The cost of going quiet",
    cost: "A brand that posts in bursts trains customers to forget it. The list you don't email is a list you're slowly losing. The launch you under-promote is revenue you'll never see and never miss, because you can't grieve a number you never knew you'd hit.\n\nConsistency isn't the boring part of e-commerce. It's the whole game. And it's the first thing to go.",
    whatHeadline: "What Maya handles",
    what: "Maya runs the brand's marketing layer. Tell her about the drop; she returns the launch sequence — teasers, emails, posts — in your voice, ready to approve. She watches what competing brands are running so you're never blindsided by a sale. She keeps the revenue loops closed: the abandoned cart, the post-purchase follow-up, the win-back to the list going cold.\n\nYou stay in control. Nothing sends until you say so. Maya does the work; you make the calls.",
    bullets: [
      { heading: "A drop becomes a campaign in an afternoon.", body: "Tell Maya the product; get the full launch sequence built around your brand — review, approve, ship." },
      { heading: "You're never undercut blind.", body: "Maya watches competing brands and flags the promo before it eats your weekend." },
      { heading: "The list stays warm.", body: "Win-backs, follow-ups, and cart recoveries surfaced and ready — the revenue most stores leave on the table." },
      { heading: "One voice, every channel.", body: "Maya learns your brand once and holds it across email, social, and the site." },
    ],
    where: "In one conversation. You direct in plain language; she plans, creates, and executes — the always-on marketing team a growing brand needs, without the headcount. The store stops going quiet between launches. You get back to building.",
  },
  {
    slug: 'local-service',
    label: 'Local service businesses',
    accent: '#10B981',
    hero: {
      headline: "Good at the work. Now visible for it.",
      subhead: "You're good at the work — the cut, the repair, the treatment, the build. The marketing is the part nobody trained you for, and it's the part that fills the calendar. How Maya keeps you visible so you can stay heads-down on the job.",
    },
    setup: "A service business runs on the job in front of you. The client in the chair, the house you're quoting, the appointment running long. You can't market and serve at the same time — and serving always wins, as it should.\n\nSo marketing happens at 9pm, or it doesn't happen.\n\nEvery owner we talk to fights the same battle: the customers come from being seen — the review answered, the post that shows your work, the promo for the slow week — and being seen is the work you never have time for. The slow week comes anyway. You meant to do something about it.",
    costHeadline: "The cost of being invisible",
    cost: "The competitor across town isn't better than you. They're just more present. They answer the reviews, they post the before-and-afters, they run the seasonal offer — so when someone searches, they're the obvious choice. You were busy doing great work nobody saw.\n\nEvery quiet week is bookings that went somewhere else. You never see the customer who chose the business that showed up.",
    whatHeadline: "What Maya handles",
    what: "Maya runs the marketing layer of your business. Tell her you want to fill next week; she drafts the offer and the posts to push it, in your voice, ready to approve. She watches local competitors so you know what they're running. She keeps the reputation loops closed — the review that needs a reply, the follow-up to the lead who went cold.\n\nYou stay in control. Nothing posts until you approve it. Maya does the work; you make the calls.",
    bullets: [
      { heading: "A slow week becomes a promotion overnight.", body: "Tell Maya the gap; get the offer and the posts to fill it — review, approve, ship." },
      { heading: "You're never the last to know.", body: "Maya watches local competitors and tells you what they're doing to win the same customers." },
      { heading: "No review goes unanswered.", body: "Replies and follow-ups surfaced and ready — the reputation work that quietly decides who gets the call." },
      { heading: "One voice, everywhere you show up.", body: "Maya learns your business once and sounds like you across every post and page." },
    ],
    where: "In one conversation. You direct in plain language; she plans, creates, and executes — marketing that runs while you're on the job, not after it. You stop being invisible on your busy weeks. You stop marketing at 9pm.",
  },
  {
    slug: 'coaches-creators',
    label: 'Coaches, creators & solo founders',
    accent: '#F5349B',
    hero: {
      headline: "Finally in two places at once.",
      subhead: "You are the product, the brand, and the marketing department — all in one person, with the same twenty-four hours as everyone else. How Maya carries the marketing so you can do the thing only you can do.",
    },
    setup: "When you're a team of one, every hour is a trade. An hour writing the email is an hour not coaching, not creating, not building the thing people actually pay for. The marketing competes directly with the work — and the work always feels more urgent.\n\nSo the marketing gets the leftover hours. Usually there aren't any.\n\nEvery solo operator we talk to fights the same battle: the audience grows by showing up — the post, the newsletter, the launch told to enough people — and showing up consistently is a full-time job stacked on top of your full-time job. You go quiet. The momentum you built leaks away while you're busy delivering.",
    costHeadline: "The cost of doing it all yourself",
    cost: "Going solo means the marketing is always the first thing to drop, because you're the only one who can drop it. A week heads-down on client work is a week your audience hears nothing. The launch you under-promote because you ran out of steam is the launch that quietly flops.\n\nYou can't scale yourself. That's the real ceiling — not your ideas, your hours.",
    whatHeadline: "What Maya handles",
    what: "Maya runs the marketing layer so you don't have to be in two places at once. Tell her about the offer; she returns the launch — emails, posts, the whole push — in your voice, ready to approve. She tracks what's trending in your space so you're not the last to a conversation. She keeps the loops closed: the newsletter that's overdue, the follow-up to a warm lead, the next post when you've gone quiet.\n\nYou stay in control. Nothing goes out until you approve it. Maya does the work; you make the calls.",
    bullets: [
      { heading: "A launch runs itself.", body: "Tell Maya the offer; get the full sequence in your voice — review, approve, ship." },
      { heading: "You're never late to the conversation.", body: "Maya tracks your niche and surfaces what's worth weighing in on while it's hot." },
      { heading: "The momentum doesn't leak.", body: "Newsletters, follow-ups, and posts surfaced and ready — so heads-down weeks don't go silent." },
      { heading: "It still sounds like you.", body: "Maya learns your voice once and protects it — the one thing a solo brand can't afford to outsource badly." },
    ],
    where: "In one conversation. You direct in plain language; she plans, creates, and executes — the marketing team you can't afford to hire and can't afford to skip. You stop trading the work for the marketing. You finally get to be in two places at once.",
  },
  {
    slug: 'agencies',
    label: 'Agencies',
    accent: '#3286FE',
    hero: {
      headline: "Your team back on the work that justifies the rate.",
      subhead: "Your team does creative work — strategy, content, campaigns that actually land. But a chunk of every week disappears into execution and client busywork that doesn't touch the creative. How Maya handles the production layer so your people stay on the work that matters.",
    },
    setup: "Agency work is creative work. The strategy, the concept, the campaign that moves a client's numbers. That's what you sell, and that's where your margin lives.\n\nThe production grind is not where your margin lives.\n\nEvery agency owner we talk to fights the same battle: the high-value thinking competes for hours against the high-volume doing — the fifteenth caption variant, the routine client report, the campaign built for the tenth time across ten accounts. Your best people get pulled out of the work that matters to do the work that just has to get done.",
    costHeadline: "The cost of the production drag",
    cost: "Talent burns out on volume, not on hard problems. When senior creatives spend their week on rote execution, the strategic work gets thinner, clients feel it, and accounts get shaky. You're paying expert rates for assembly-line hours — and the math gets worse with every account you add.\n\nIt doesn't scale. Growth just means more volume crushing the same people.",
    whatHeadline: "What Maya handles",
    what: "Maya runs the production layer across your accounts. Brief her on a client; she returns campaigns, content, and variations in that client's voice, ready for your team to review. She watches each client's competitors and surfaces what's worth acting on. She keeps the routine output moving — the reports, the recurring posts, the follow-ups — so your people don't.\n\nYour team stays in control. Everything routes through them before it reaches a client. Maya does the volume; your experts do the thinking.",
    bullets: [
      { heading: "Campaigns drafted per account, in each client's voice.", body: "Brief Maya; your team reviews and refines instead of building from zero." },
      { heading: "Competitive intel without the manual research.", body: "Maya watches each client's market and surfaces what matters." },
      { heading: "The routine output runs itself.", body: "Recurring posts, reports, and follow-ups handled — billable hours freed for strategy." },
      { heading: "Voice held per client, automatically.", body: "Maya keeps every account distinct — no bleed, no generic." },
    ],
    where: "Behind your team, across your book of business. You stay the strategist and the face; Maya is the production capacity you'd otherwise have to hire and manage. Your people get back to the work clients actually pay for. The margin comes with them.",
  },
];
