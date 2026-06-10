// Realistic SMB mock data for trial / no-plan users.
// Numbers are mid-range: plausible after 6 months of consistent posting.
// Not aspirational (enterprise) and not minimal (near-zero).

export const MOCK_GA_DATA = {
  summary: {
    sessions: 1240,
    users: 890,
    pageviews: 2180,
    bounceRate: '42',
    newUsers: 412,
    avgSessionDuration: 154,
  },
  deltas: { sessions: 12.4, users: 9.1, pageviews: 8.3, newUsers: 15.2 },
  chartData: [
    { day: 'Mon', sessions: 142, users: 118 },
    { day: 'Tue', sessions: 224, users: 191 },
    { day: 'Wed', sessions: 189, users: 154 },
    { day: 'Thu', sessions: 201, users: 167 },
    { day: 'Fri', sessions: 176, users: 143 },
    { day: 'Sat', sessions: 152, users: 121 },
    { day: 'Sun', sessions: 156, users: 124 },
  ],
  activityData: [
    { day: 'Mon', dau: 38, wau: 198, mau: 642 },
    { day: 'Tue', dau: 52, wau: 214, mau: 668 },
    { day: 'Wed', dau: 44, wau: 221, mau: 691 },
    { day: 'Thu', dau: 61, wau: 238, mau: 724 },
    { day: 'Fri', dau: 47, wau: 246, mau: 758 },
    { day: 'Sat', dau: 35, wau: 252, mau: 781 },
    { day: 'Sun', dau: 58, wau: 267, mau: 812 },
  ],
  topPages: [
    { path: '/services', sessions: 342, bounceRate: '38%' },
    { path: '/',         sessions: 287, bounceRate: '45%' },
    { path: '/about',    sessions: 198, bounceRate: '42%' },
    { path: '/contact',  sessions: 164, bounceRate: '36%' },
    { path: '/pricing',  sessions: 131, bounceRate: '28%' },
  ],
  trafficSources: [
    { source: 'Direct',   pct: 38 },
    { source: 'Social',   pct: 28 },
    { source: 'Organic',  pct: 22 },
    { source: 'Referral', pct: 12 },
  ],
  countries: [
    { country: 'United States',  users: 524 },
    { country: 'Canada',         users: 118 },
    { country: 'United Kingdom', users: 86 },
    { country: 'Australia',      users: 64 },
    { country: 'Germany',        users: 41 },
    { country: 'Netherlands',    users: 28 },
  ],
  devices: [
    { device: 'mobile',  users: 498 },
    { device: 'desktop', users: 342 },
    { device: 'tablet',  users: 50 },
  ],
  events: [
    { name: 'page_view',      count: 2180 },
    { name: 'session_start',  count: 1240 },
    { name: 'scroll',         count: 942 },
    { name: 'cta_click',      count: 387 },
    { name: 'user_engagement', count: 356 },
    { name: 'select_plan',    count: 92 },
    { name: 'faq_open',       count: 74 },
    { name: 'sign_up_click',  count: 58 },
  ],
}

export const MOCK_ANALYTICS_SOCIAL = {
  overview: {
    totalFollowers:     2847,
    followerGrowth:     124,
    followerGrowthPct:  4.6,
    totalReach:         18420,
    engagementRate:     3.2,
    postsThisPeriod:    14,
  },
  platforms: {
    instagram: { followers: 1842, reach: 12400, engagementRate: 3.8, posts: 8 },
    facebook:  { followers: 680,  reach: 4200,  engagementRate: 1.9, posts: 4 },
    tiktok:    { followers: 325,  reach: 1820,  engagementRate: 5.1, posts: 2 },
  },
  topPosts: [
    { platform: 'instagram', content: 'Behind the scenes of our process…',
      reach: 2840, likes: 187, engagementRate: 6.6, date: '2026-05-28' },
    { platform: 'instagram', content: 'Customer story: how we helped…',
      reach: 2210, likes: 143, engagementRate: 5.2, date: '2026-05-24' },
    { platform: 'facebook',  content: 'Our new summer collection is here',
      reach: 1840, likes: 89,  engagementRate: 4.1, date: '2026-05-21' },
    { platform: 'tiktok',    content: '3 things nobody tells you about…',
      reach: 1820, likes: 234, engagementRate: 5.1, date: '2026-05-19' },
    { platform: 'instagram', content: 'Throwback to when we first started…',
      reach: 1640, likes: 112, engagementRate: 4.8, date: '2026-05-15' },
  ],
  bestTimeToPost: { day: 'Tuesday', hour: '6:00 PM', avgEngagement: 510 },
  followerHistory: [
    { date: 'May 7',  followers: 2720 },
    { date: 'May 8',  followers: 2724 },
    { date: 'May 9',  followers: 2729 },
    { date: 'May 10', followers: 2733 },
    { date: 'May 11', followers: 2738 },
    { date: 'May 12', followers: 2741 },
    { date: 'May 13', followers: 2744 },
    { date: 'May 14', followers: 2749 },
    { date: 'May 15', followers: 2754 },
    { date: 'May 16', followers: 2759 },
    { date: 'May 17', followers: 2764 },
    { date: 'May 18', followers: 2768 },
    { date: 'May 19', followers: 2771 },
    { date: 'May 20', followers: 2774 },
    { date: 'May 21', followers: 2778 },
    { date: 'May 22', followers: 2782 },
    { date: 'May 23', followers: 2787 },
    { date: 'May 24', followers: 2792 },
    { date: 'May 25', followers: 2796 },
    { date: 'May 26', followers: 2799 },
    { date: 'May 27', followers: 2803 },
    { date: 'May 28', followers: 2808 },
    { date: 'May 29', followers: 2814 },
    { date: 'May 30', followers: 2819 },
    { date: 'May 31', followers: 2824 },
    { date: 'Jun 1',  followers: 2827 },
    { date: 'Jun 2',  followers: 2830 },
    { date: 'Jun 3',  followers: 2836 },
    { date: 'Jun 4',  followers: 2841 },
    { date: 'Jun 5',  followers: 2847 },
  ],
  dailyMetrics: [
    { date: 'May 7',  posts: 1, impressions: 2240, reach: 1840, likes: 124, comments: 8,  shares: 5 },
    { date: 'May 8',  posts: 1, impressions: 1980, reach: 1560, likes: 98,  comments: 6,  shares: 3 },
    { date: 'May 9',  posts: 0, impressions: 340,  reach: 280,  likes: 14,  comments: 1,  shares: 0 },
    { date: 'May 10', posts: 0, impressions: 290,  reach: 240,  likes: 11,  comments: 0,  shares: 0 },
    { date: 'May 11', posts: 1, impressions: 2100, reach: 1720, likes: 112, comments: 7,  shares: 4 },
    { date: 'May 12', posts: 1, impressions: 2840, reach: 2380, likes: 187, comments: 14, shares: 9 },
    { date: 'May 13', posts: 0, impressions: 480,  reach: 380,  likes: 22,  comments: 2,  shares: 1 },
    { date: 'May 14', posts: 1, impressions: 1740, reach: 1420, likes: 89,  comments: 5,  shares: 3 },
    { date: 'May 15', posts: 0, impressions: 380,  reach: 310,  likes: 16,  comments: 1,  shares: 0 },
    { date: 'May 16', posts: 1, impressions: 1580, reach: 1280, likes: 76,  comments: 4,  shares: 2 },
    { date: 'May 17', posts: 0, impressions: 260,  reach: 210,  likes: 9,   comments: 0,  shares: 0 },
    { date: 'May 18', posts: 1, impressions: 1920, reach: 1580, likes: 104, comments: 7,  shares: 4 },
    { date: 'May 19', posts: 1, impressions: 2210, reach: 1840, likes: 143, comments: 11, shares: 6 },
    { date: 'May 20', posts: 0, impressions: 420,  reach: 340,  likes: 18,  comments: 1,  shares: 0 },
    { date: 'May 21', posts: 1, impressions: 1840, reach: 1480, likes: 94,  comments: 6,  shares: 3 },
    { date: 'May 22', posts: 0, impressions: 310,  reach: 250,  likes: 12,  comments: 0,  shares: 0 },
    { date: 'May 23', posts: 0, impressions: 280,  reach: 220,  likes: 10,  comments: 0,  shares: 0 },
    { date: 'May 24', posts: 0, impressions: 310,  reach: 250,  likes: 13,  comments: 0,  shares: 0 },
    { date: 'May 25', posts: 1, impressions: 1980, reach: 1620, likes: 108, comments: 8,  shares: 4 },
    { date: 'May 26', posts: 1, impressions: 2380, reach: 1960, likes: 162, comments: 12, shares: 7 },
    { date: 'May 27', posts: 0, impressions: 440,  reach: 360,  likes: 20,  comments: 1,  shares: 0 },
    { date: 'May 28', posts: 1, impressions: 2840, reach: 2380, likes: 187, comments: 15, shares: 8 },
    { date: 'May 29', posts: 0, impressions: 380,  reach: 310,  likes: 16,  comments: 1,  shares: 0 },
    { date: 'May 30', posts: 0, impressions: 290,  reach: 240,  likes: 11,  comments: 0,  shares: 0 },
    { date: 'May 31', posts: 0, impressions: 260,  reach: 210,  likes: 9,   comments: 0,  shares: 0 },
    { date: 'Jun 1',  posts: 0, impressions: 240,  reach: 190,  likes: 8,   comments: 0,  shares: 0 },
    { date: 'Jun 2',  posts: 1, impressions: 2140, reach: 1760, likes: 118, comments: 9,  shares: 5 },
    { date: 'Jun 3',  posts: 1, impressions: 1980, reach: 1620, likes: 104, comments: 7,  shares: 3 },
    { date: 'Jun 4',  posts: 0, impressions: 360,  reach: 290,  likes: 14,  comments: 1,  shares: 0 },
    { date: 'Jun 5',  posts: 0, impressions: 280,  reach: 220,  likes: 10,  comments: 0,  shares: 0 },
  ],
  contentDecay: {
    buckets: [
      { label: '0–6h',  pct: 48.2 },
      { label: '6–12h', pct: 19.4 },
      { label: '12–24h',pct: 14.8 },
      { label: '1–2d',  pct: 9.1  },
      { label: '2–7d',  pct: 6.3  },
      { label: '7–30d', pct: 2.2  },
    ],
  },
}

export const MOCK_ANALYTICS_ADS = {
  overview: {
    totalSpend:  340.50,
    totalReach:  24800,
    totalClicks: 412,
    avgCTR:      1.66,
  },
  platforms: {
    meta_ads:   { spend: 280.00, reach: 19200, clicks: 334, ctr: 1.74 },
    google_ads: { spend: 60.50,  reach: 5600,  clicks: 78,  ctr: 1.39 },
  },
  campaigns: [
    { name: 'Summer Sale — Instagram',    platform: 'meta_ads',   spend: 180.00, reach: 12400, clicks: 218, ctr: 1.76, status: 'active' },
    { name: 'Brand Awareness — Facebook', platform: 'meta_ads',   spend: 100.00, reach: 6800,  clicks: 116, ctr: 1.71, status: 'active' },
    { name: 'Search — Brand Keywords',    platform: 'google_ads', spend: 60.50,  reach: 5600,  clicks: 78,  ctr: 1.39, status: 'active' },
  ],
  spendOverTime: [
    { date: 'Mon', spend: 44.20 },
    { date: 'Tue', spend: 51.30 },
    { date: 'Wed', spend: 46.80 },
    { date: 'Thu', spend: 49.50 },
    { date: 'Fri', spend: 52.10 },
    { date: 'Sat', spend: 48.30 },
    { date: 'Sun', spend: 48.30 },
  ],
  ctrTrend: [
    { date: 'Mon', ctr: 1.82 },
    { date: 'Tue', ctr: 1.79 },
    { date: 'Wed', ctr: 1.74 },
    { date: 'Thu', ctr: 1.71 },
    { date: 'Fri', ctr: 1.68 },
    { date: 'Sat', ctr: 1.66 },
    { date: 'Sun', ctr: 1.66 },
  ],
}

export const MOCK_ANALYTICS_INBOX = {
  totalComments: 47,
  totalDMs:      23,
  responseRate:  68,
  platforms: [
    { platform: 'instagram', comments: 31, dms: 18, unread: 4 },
    { platform: 'facebook',  comments: 16, dms: 5,  unread: 1 },
  ],
  trend: [
    { date: 'Mon', comments: 6,  dms: 3 },
    { date: 'Tue', comments: 8,  dms: 4 },
    { date: 'Wed', comments: 4,  dms: 2 },
    { date: 'Thu', comments: 7,  dms: 4 },
    { date: 'Fri', comments: 9,  dms: 4 },
    { date: 'Sat', comments: 6,  dms: 3 },
    { date: 'Sun', comments: 7,  dms: 3 },
  ],
}

// Platforms shown in mock state connection strip
export const MOCK_CONNECTED_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'meta_ads']

export const MOCK_POSTING_ANALYTICS = {
  // 5 summary stat cards
  stats: {
    engagementRate: 3.2,
    engRateDelta: '+0.4 pts',
    engRateDeltaPositive: true,
    totalReach: 18420,
    reachDelta: '+2.1k new',
    reachDeltaPositive: true,
    totalFollowers: 2847,
    followersDelta: '+124 in last 30d',
    followersDeltaPositive: true,
    postsThisPeriod: 14,
    bestPost: {
      caption: 'Behind the scenes of our process…',
      platform: 'instagram',
      engagements: 218,
    },
  },

  // Monthly time series — 13 months (Jun last year → Jun this year)
  monthly: [
    { month: 'Jun', posts: 0, likes: 0,   comments: 0,  shares: 0,  saves: 0,  views: 0,     impressions: 0,     reach: 0,     clicks: 0,  engRate: 0 },
    { month: 'Jul', posts: 2, likes: 182,  comments: 12, shares: 6,  saves: 8,  views: 1240,  impressions: 1480,  reach: 980,   clicks: 14, engRate: 2.8 },
    { month: 'Aug', posts: 3, likes: 248,  comments: 18, shares: 9,  saves: 12, views: 1840,  impressions: 2200,  reach: 1520,  clicks: 22, engRate: 3.1 },
    { month: 'Sep', posts: 4, likes: 312,  comments: 24, shares: 11, saves: 15, views: 2180,  impressions: 2640,  reach: 1840,  clicks: 28, engRate: 3.0 },
    { month: 'Oct', posts: 3, likes: 276,  comments: 19, shares: 8,  saves: 11, views: 1980,  impressions: 2380,  reach: 1640,  clicks: 24, engRate: 2.9 },
    { month: 'Nov', posts: 5, likes: 418,  comments: 31, shares: 14, saves: 19, views: 2840,  impressions: 3380,  reach: 2420,  clicks: 36, engRate: 3.4 },
    { month: 'Dec', posts: 4, likes: 384,  comments: 28, shares: 12, saves: 17, views: 2640,  impressions: 3140,  reach: 2180,  clicks: 32, engRate: 3.3 },
    { month: 'Jan', posts: 3, likes: 294,  comments: 21, shares: 9,  saves: 13, views: 2080,  impressions: 2480,  reach: 1720,  clicks: 26, engRate: 3.1 },
    { month: 'Feb', posts: 5, likes: 442,  comments: 34, shares: 15, saves: 21, views: 3080,  impressions: 3640,  reach: 2580,  clicks: 39, engRate: 3.6 },
    { month: 'Mar', posts: 6, likes: 512,  comments: 41, shares: 18, saves: 24, views: 3540,  impressions: 4180,  reach: 2980,  clicks: 44, engRate: 3.8 },
    { month: 'Apr', posts: 5, likes: 468,  comments: 37, shares: 16, saves: 22, views: 3280,  impressions: 3840,  reach: 2740,  clicks: 41, engRate: 3.7 },
    { month: 'May', posts: 7, likes: 584,  comments: 48, shares: 21, saves: 28, views: 4180,  impressions: 4940,  reach: 3480,  clicks: 52, engRate: 4.1 },
    { month: 'Jun', posts: 2, likes: 186,  comments: 16, shares: 7,  saves: 9,  views: 1340,  impressions: 1580,  reach: 1120,  clicks: 17, engRate: 3.9 },
  ],

  // Posts by platform (bar chart)
  platformPosts: [
    { platform: 'instagram', label: 'Instagram', posts: 8  },
    { platform: 'facebook',  label: 'Facebook',  posts: 4  },
    { platform: 'tiktok',    label: 'TikTok',    posts: 2  },
  ],

  // Likes by platform (bar chart)
  platformLikes: [
    { platform: 'instagram', label: 'Instagram', likes: 1840 },
    { platform: 'facebook',  label: 'Facebook',  likes: 486  },
    { platform: 'tiktok',    label: 'TikTok',    likes: 258  },
  ],

  // Best time to post heatmap
  // data[dayIndex][timeIndex] = engagement value 0–10
  heatmap: {
    days:  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    times: ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'],
    data: [
      [0, 0, 0, 1, 2, 3, 4, 2],
      [0, 0, 0, 2, 3, 4, 7, 3],
      [0, 0, 0, 1, 3, 3, 5, 2],
      [0, 0, 0, 1, 2, 4, 4, 3],
      [0, 0, 0, 1, 2, 3, 3, 9],
      [0, 0, 0, 1, 3, 2, 2, 1],
      [0, 0, 0, 1, 2, 2, 3, 2],
    ],
    bestDay:  'Fri',
    bestTime: '9pm',
  },

  // Follower evolution — monthly
  followerEvolution: [
    { month: 'Jun', followers: 2420 },
    { month: 'Jul', followers: 2456 },
    { month: 'Aug', followers: 2492 },
    { month: 'Sep', followers: 2534 },
    { month: 'Oct', followers: 2568 },
    { month: 'Nov', followers: 2610 },
    { month: 'Dec', followers: 2648 },
    { month: 'Jan', followers: 2682 },
    { month: 'Feb', followers: 2718 },
    { month: 'Mar', followers: 2758 },
    { month: 'Apr', followers: 2798 },
    { month: 'May', followers: 2826 },
    { month: 'Jun', followers: 2847 },
  ],

  // Platform breakdown table
  platformBreakdown: [
    { platform: 'instagram', label: 'Instagram', posts: 8, likes: 1840, comments: 124, shares: 48, saves: 86,  clicks: 0,  views: 14200, impressions: 16800, reach: 11400, erPct: 3.8 },
    { platform: 'facebook',  label: 'Facebook',  posts: 4, likes: 486,  comments: 38,  shares: 22, saves: 0,   clicks: 84, views: 3840,  impressions: 4200,  reach: 3180,  erPct: 2.1 },
    { platform: 'tiktok',    label: 'TikTok',    posts: 2, likes: 258,  comments: 31,  shares: 18, saves: 42,  clicks: 0,  views: 8240,  impressions: 9100,  reach: 7200,  erPct: 5.1 },
  ],

  // Top performing posts
  topPosts: [
    { platform: 'instagram', caption: 'Behind the scenes of our process…',            date: 'Jun 5, 2026',  likes: 187, comments: 14, shares: 9,  saves: 18, clicks: 0,  views: 2840,  impressions: 3280, reach: 2380, erPct: 6.6 },
    { platform: 'instagram', caption: 'Customer story: how we helped them grow',       date: 'May 28, 2026', likes: 143, comments: 11, shares: 6,  saves: 12, clicks: 0,  views: 2210,  impressions: 2580, reach: 1840, erPct: 5.2 },
    { platform: 'tiktok',    caption: '3 things nobody tells you about running a small biz', date: 'May 19, 2026', likes: 234, comments: 31, shares: 18, saves: 42, clicks: 0,  views: 8240,  impressions: 9100, reach: 7200, erPct: 5.1 },
    { platform: 'facebook',  caption: 'Our new summer collection is here',             date: 'May 21, 2026', likes: 89,  comments: 6,  shares: 5,  saves: 0,  clicks: 24, views: 1840,  impressions: 2100, reach: 1480, erPct: 4.1 },
    { platform: 'instagram', caption: 'Throwback to when we first started this journey', date: 'May 15, 2026', likes: 112, comments: 8,  shares: 4,  saves: 14, clicks: 0,  views: 1640,  impressions: 1920, reach: 1340, erPct: 4.8 },
  ],

  // Posting frequency vs engagement scatter
  // x = numeric (1=<1/wk, 2=1-2/wk, 3=3-4/wk, 4=5+/wk)
  // y = engagement rate %
  postingFrequency: [
    { x: 1, y: 2.4, platform: 'instagram', freqLabel: '< 1/wk'  },
    { x: 2, y: 3.8, platform: 'instagram', freqLabel: '1–2/wk'  },
    { x: 3, y: 3.2, platform: 'instagram', freqLabel: '3–4/wk'  },
    { x: 4, y: 2.8, platform: 'instagram', freqLabel: '5+/wk'   },
    { x: 2, y: 2.1, platform: 'facebook',  freqLabel: '1–2/wk'  },
    { x: 3, y: 1.9, platform: 'facebook',  freqLabel: '3–4/wk'  },
  ],
  optimalCadence: [
    { platform: 'instagram', label: 'Instagram', cadence: '1–2/wk', engRate: 3.8 },
    { platform: 'facebook',  label: 'Facebook',  cadence: '1–2/wk', engRate: 2.1 },
  ],

  // Engagement accumulation over time after publishing
  engagementAccumulation: [
    { time: 'Publish', pct: 0   },
    { time: '0–6h',    pct: 48  },
    { time: '6–12h',   pct: 62  },
    { time: '12–24h',  pct: 75  },
    { time: '1–2d',    pct: 84  },
    { time: '2–7d',    pct: 91  },
    { time: '7–30d',   pct: 96  },
    { time: '30d+',    pct: 100 },
  ],
  halfEngagementTime:   '0–6h',
  eightyPctTime:        '1–2d',
}
