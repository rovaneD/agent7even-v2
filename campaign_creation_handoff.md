# Campaign Creation — Segment-First + Open Canvas
*Work queue item 5*

Read MAYA_CONTEXT.md before starting. Confirm `git remote -v` shows `agent7even-v2`.

---

## Overview

Replace the current "New campaign" flow with two modes:
1. **Guided** — segment-first structured flow, Maya builds the plan
2. **Open Canvas** — freeform brainstorm with Maya, same campaign artifact output

Both modes produce the same campaign artifact saved to the database.
Entry point: "New campaign" button in sidebar and Dashboard.

---

## Part 1 — Schema

Run in Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title            text NOT NULL,
  status           text DEFAULT 'active',      -- active | paused | completed | archived
  mode             text NOT NULL,              -- 'guided' | 'open_canvas'
  segment          text,                       -- guided only
  goal             text,                       -- guided only
  timeline_days    integer,                    -- guided only
  strategy_summary text,                       -- Maya-generated
  do_this_today    jsonb,                       -- array of { task, channel, cta }
  week_plan        jsonb,                       -- array of { week, theme, days: [{day, channel, type, content, mins}] }
  chat_session_id  text,                       -- Maya chat session that built this
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_campaigns_user ON campaigns(user_id, created_at DESC);

-- Copy options saved during campaign creation
CREATE TABLE IF NOT EXISTS campaign_copy_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  field_key   text NOT NULL,   -- e.g. 'instagram_bio', 'headline', 'subject_line'
  option_a    text,
  option_b    text,
  option_c    text,
  selected    text,            -- 'a' | 'b' | 'c' | null
  created_at  timestamptz DEFAULT now()
);
```

---

## Part 2 — New Campaign Modal

Create `components/campaigns/NewCampaignModal.tsx`.

Triggered by: "New campaign" button in sidebar + Dashboard CTA.

### Modal UI

```tsx
export default function NewCampaignModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()

  return (
    <Modal open={open} onClose={onClose} title="New campaign" size="md">
      <p className="text-sm text-gray-500 mb-6">
        How do you want to approach this campaign?
      </p>

      <div className="grid grid-cols-2 gap-4">

        {/* Guided */}
        <button
          onClick={() => {
            onClose()
            router.push('/dashboard/campaigns/new?mode=guided')
          }}
          className="group text-left p-5 rounded-2xl border-2 border-gray-100
                     hover:border-black transition-all duration-150"
        >
          <div className="w-9 h-9 rounded-xl bg-gray-100 group-hover:bg-black
                          flex items-center justify-center mb-3 transition-colors">
            <TargetIcon className="w-4 h-4 text-gray-600 group-hover:text-white" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Guided</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            I know my audience. Walk me through building a targeted campaign.
          </p>
        </button>

        {/* Open Canvas */}
        <button
          onClick={() => {
            onClose()
            router.push('/dashboard/campaigns/new?mode=open')
          }}
          className="group text-left p-5 rounded-2xl border-2 border-gray-100
                     hover:border-black transition-all duration-150"
        >
          <div className="w-9 h-9 rounded-xl bg-gray-100 group-hover:bg-black
                          flex items-center justify-center mb-3 transition-colors">
            <SparklesIcon className="w-4 h-4 text-gray-600 group-hover:text-white" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Open canvas</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            I have a specific situation or idea. Let Maya help me figure it out.
          </p>
        </button>

      </div>

      <p className="text-xs text-gray-400 text-center mt-4">
        Both create a full campaign plan saved to My campaigns
      </p>
    </Modal>
  )
}
```

---

## Part 3 — Campaign Creation Page

Create `app/dashboard/campaigns/new/page.tsx`.

Reads `?mode=guided` or `?mode=open` from search params.

```tsx
export default function NewCampaignPage() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') ?? 'guided'

  return mode === 'guided'
    ? <GuidedCampaignFlow />
    : <OpenCanvasFlow />
}
```

---

## Part 4 — Guided Flow

Create `components/campaigns/GuidedCampaignFlow.tsx`.

3-step flow. Progress indicator at top (Step 1 of 3).

### Step 1 — Who are you reaching?

```tsx
const SEGMENTS = [
  {
    id: 'past_customers',
    label: 'Past customers',
    description: 'People who bought but haven\'t returned',
    icon: '🔄',
  },
  {
    id: 'warm_leads',
    label: 'Warm leads gone quiet',
    description: 'Engaged but didn\'t convert',
    icon: '🌡️',
  },
  {
    id: 'current_customers',
    label: 'Current customers',
    description: 'Upsell, retain, or get referrals',
    icon: '⭐',
  },
  {
    id: 'cold_audience',
    label: 'Cold audience',
    description: 'Brand new, never heard of you',
    icon: '🎯',
  },
  {
    id: 're_engagement',
    label: 'Re-engagement',
    description: 'Inactive subscribers or followers',
    icon: '💬',
  },
]

// Render as selectable cards — single select
// "Next →" button enabled when one selected
```

### Step 2 — What's the goal?

Goals adapt based on segment selected in Step 1:

```typescript
const GOALS_BY_SEGMENT: Record<string, { id: string; label: string }[]> = {
  past_customers: [
    { id: 'repeat_purchase', label: 'Get them to buy again' },
    { id: 'upsell',          label: 'Upsell to a higher tier' },
    { id: 'referral',        label: 'Get a referral' },
  ],
  warm_leads: [
    { id: 'convert',         label: 'Convert to a sale' },
    { id: 'book_call',       label: 'Book a discovery call' },
    { id: 'free_offer',      label: 'Get them to try a free offer' },
  ],
  current_customers: [
    { id: 'retention',       label: 'Keep them engaged' },
    { id: 'upsell',          label: 'Upsell or cross-sell' },
    { id: 'referral',        label: 'Generate referrals' },
  ],
  cold_audience: [
    { id: 'awareness',       label: 'Build awareness' },
    { id: 'email_list',      label: 'Drive to email list' },
    { id: 'first_purchase',  label: 'Get first purchase' },
  ],
  re_engagement: [
    { id: 'reactivate',      label: 'Win them back' },
    { id: 'survey',          label: 'Understand why they left' },
    { id: 'soft_offer',      label: 'Make a low-risk offer' },
  ],
}
```

### Step 3 — Timeline and budget

```tsx
const TIMELINES = [
  { id: 14,  label: '2 weeks',  description: 'Quick sprint' },
  { id: 30,  label: '30 days',  description: 'Standard campaign' },
  { id: 60,  label: '60 days',  description: 'Full push' },
]

// Budget — pre-fill from Foundation if available:
// profile.foundation_answers.marketingBudget
// Otherwise show selector:
const BUDGETS = [
  { id: 'under_500',      label: 'Under $500/mo' },
  { id: '500_1500',       label: '$500–$1,500/mo' },
  { id: '1500_5000',      label: '$1,500–$5,000/mo' },
  { id: 'over_5000',      label: 'Over $5,000/mo' },
]
```

### On "Build my campaign" — guided generation

Call `POST /api/campaigns/generate`:

```typescript
{
  mode: 'guided',
  segment,
  goal,
  timelineDays,
  budget,
}
```

Show generation screen — same animated checklist pattern as Foundation:
```
✓ Analyzing your audience segment...
✓ Matching to your brand voice...
✓ Building week-by-week plan...
✓ Creating today's action list...
✓ Campaign ready
```

On complete → redirect to `/dashboard/campaigns/[id]`

---

## Part 5 — Open Canvas Flow

Create `components/campaigns/OpenCanvasFlow.tsx`.

Full-width Maya chat. No structure imposed. Maya opens with:

```
"Tell me what's going on — what are you trying to solve or achieve 
with this campaign? Don't worry about fitting it into a template, 
just describe the situation."
```

Maya has Foundation context injected into system prompt automatically
(same as all other Maya chats via canvasContext).

### The key addition to the system prompt for open canvas:

```typescript
const openCanvasSystemPrompt = `
You are Maya, helping the user build a marketing campaign from scratch.

The user has chosen Open Canvas mode — they have a specific situation,
idea, or problem that doesn't fit a standard template. Your job is to:

1. Ask smart questions to understand their specific situation
2. Help them think through the problem and the opportunity
3. Propose a campaign approach that fits their unique case
4. When you have enough context, offer to build the full campaign plan

Foundation context:
${foundationContext}

When you have enough information to build a campaign, say:
"I have what I need to build this. Want me to generate the full plan?"

When the user confirms, call the generate_campaign function with the
campaign details you've gathered.
`
```

### Detecting when Maya is ready to generate

Maya says a specific trigger phrase when ready:
"I have what I need to build this. Want me to generate the full plan?"

When user confirms → show the same generation animation → save campaign →
redirect to `/dashboard/campaigns/[id]`

### Saving open canvas campaigns

When Maya generates from open canvas, she produces the same JSON structure
as guided — title, strategy_summary, do_this_today, week_plan — but arrived
at it conversationally. Saved to `campaigns` table with `mode = 'open_canvas'`.

---

## Part 6 — Campaign Generation API

Create `app/api/campaigns/generate/route.ts`:

```typescript
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { openRouterComplete } from '@/lib/agents/openrouter'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const body = await req.json()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, foundation_answers')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const isGuided = body.mode === 'guided'

  const prompt = isGuided
    ? buildGuidedPrompt(body, profile)
    : buildOpenCanvasPrompt(body, profile)

  const result = await openRouterComplete({
    model: 'anthropic/claude-sonnet-4',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4000,
    temperature: 0.7,
  })

  let campaign: any
  try {
    const clean = result.content.replace(/```json|```/g, '').trim()
    campaign = JSON.parse(clean)
  } catch {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }

  // Save to campaigns table
  const { data: saved, error } = await supabase
    .from('campaigns')
    .insert({
      user_id:          profile.id,
      title:            campaign.title,
      mode:             body.mode,
      segment:          body.segment ?? null,
      goal:             body.goal ?? null,
      timeline_days:    body.timelineDays ?? null,
      strategy_summary: campaign.strategySummary,
      do_this_today:    campaign.doThisToday,
      week_plan:        campaign.weekPlan,
      status:           'active',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ campaignId: saved.id })
}

function buildGuidedPrompt(body: any, profile: any): string {
  return `You are Maya, an AI marketing strategist.

Build a complete marketing campaign for the following:

Business: ${profile.company_name}
Foundation context: ${JSON.stringify(profile.foundation_answers)}

Campaign parameters:
- Audience segment: ${body.segment}
- Goal: ${body.goal}
- Timeline: ${body.timelineDays} days
- Budget: ${body.budget}

Return ONLY valid JSON with this exact structure:
{
  "title": "Campaign name (specific and descriptive)",
  "strategySummary": "2-3 sentences explaining the approach and why it fits this segment",
  "doThisToday": [
    {
      "task": "Specific action to take today",
      "channel": "instagram | email | ads | organic",
      "cta": "Do this with Maya →"
    }
  ],
  "weekPlan": [
    {
      "week": 1,
      "theme": "Week theme",
      "days": [
        {
          "day": "Mon",
          "channel": "Instagram",
          "type": "Post",
          "content": "Specific content description",
          "mins": 30
        }
      ]
    }
  ]
}`
}

function buildOpenCanvasPrompt(body: any, profile: any): string {
  return `You are Maya, an AI marketing strategist.

The user had an open canvas brainstorm session and here is what they want to build:

Business: ${profile.company_name}
Foundation context: ${JSON.stringify(profile.foundation_answers)}

Campaign brief from conversation:
${body.brief}

Build a custom campaign plan that solves their specific situation.
Return ONLY valid JSON with the same structure as a guided campaign:
{
  "title": "...",
  "strategySummary": "...",
  "doThisToday": [...],
  "weekPlan": [...]
}`
}
```

---

## Part 7 — Campaign Detail Page

Create `app/dashboard/campaigns/[id]/page.tsx`.

This is the three-panel view from the My campaigns screenshot:

```
┌──────────────────────┬──────────────────────────┬──────────────────┐
│   MAYA CHAT          │   CAMPAIGN CANVAS        │   TASK PANEL     │
│   (when open)        │                          │   (when active)  │
│                      │   Title                  │                  │
│   Always has this    │   Strategy summary       │   Copy options   │
│   campaign in        │   Do this today →        │   A / B / C      │
│   context            │   Week by week plan      │                  │
│                      │                          │   Edit mode      │
└──────────────────────┴──────────────────────────┴──────────────────┘
```

### Canvas content

```tsx
{/* Campaign header */}
<div className="mb-8">
  <div className="flex items-center gap-2 mb-1">
    <span className="text-xs font-semibold text-[#c8522a] uppercase tracking-widest">
      {campaign.mode === 'guided' ? campaign.segment?.replace('_', ' ') : 'Custom campaign'}
    </span>
    <StatusBadge status={campaign.status} />
  </div>
  <h1 className="text-2xl font-semibold text-gray-900">{campaign.title}</h1>
  <p className="text-sm text-gray-500 mt-2">{campaign.strategy_summary}</p>
</div>

{/* Do this today */}
<div className="mb-8">
  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
    Do this today
  </h3>
  {campaign.do_this_today?.map((item: any, i: number) => (
    <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <ChannelIcon channel={item.channel} />
        <span className="text-sm text-gray-800">{item.task}</span>
      </div>
      <button
        onClick={() => openMayaWithContext(item)}
        className="text-xs font-medium text-[#c8522a] hover:underline whitespace-nowrap"
      >
        Do this with Maya →
      </button>
    </div>
  ))}
</div>

{/* Week by week */}
<div>
  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
    Week by week
  </h3>
  {campaign.week_plan?.map((week: any) => (
    <WeekAccordion key={week.week} week={week} />
  ))}
</div>
```

### Maya context for this campaign

When Maya chat is open on a campaign detail page, inject into system prompt:

```typescript
const campaignContext = `
The user is viewing their campaign: "${campaign.title}"
Strategy: ${campaign.strategy_summary}
Current week: Week ${currentWeek} of ${campaign.timeline_days / 7}
Today's actions: ${JSON.stringify(campaign.do_this_today)}

You have full access to this campaign. You can:
- Explain any part of the plan
- Rewrite or improve any content
- Suggest adjustments based on results
- Generate specific content for any task
When the user clicks "Do this with Maya →" on a task, 
help them complete that specific action.
`
```

---

## Part 8 — My Campaigns List

Create `app/dashboard/campaigns/page.tsx` (or update existing My campaigns page):

```tsx
// Fetch all campaigns for user, ordered by created_at DESC
// Show as cards:

{campaigns.map(campaign => (
  <Link href={`/dashboard/campaigns/${campaign.id}`} key={campaign.id}>
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#c8522a] capitalize">
          {campaign.mode === 'guided'
            ? campaign.segment?.replace('_', ' ')
            : 'Custom campaign'}
        </span>
        <StatusBadge status={campaign.status} />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{campaign.title}</h3>
      <p className="text-xs text-gray-400">
        Created {formatDate(campaign.created_at)}
      </p>
    </div>
  </Link>
))}
```

---

## Part 9 — Wire "New campaign" button

Update the "New campaign" button in:
1. `DashboardShell` sidebar — opens `NewCampaignModal`
2. Dashboard page — opens `NewCampaignModal`
3. Maya chat mode picker — "Build a campaign" card → opens `NewCampaignModal`

```tsx
// Add state to shell or use URL param
const [showNewCampaign, setShowNewCampaign] = useState(false)

<button onClick={() => setShowNewCampaign(true)}>
  + New campaign
</button>

<NewCampaignModal
  open={showNewCampaign}
  onClose={() => setShowNewCampaign(false)}
/>
```

---

## Definition of Done

- [ ] SQL migration run — `campaigns` + `campaign_copy_options` tables
- [ ] "New campaign" button opens NewCampaignModal in sidebar + Dashboard
- [ ] Modal shows two cards: Guided and Open Canvas
- [ ] Guided flow: 3 steps (segment → goal → timeline/budget)
- [ ] Guided step 2 goals adapt based on segment selected in step 1
- [ ] Guided step 3 pre-fills budget from Foundation answers if available
- [ ] Guided "Build my campaign" → generation animation → redirect to campaign detail
- [ ] Open Canvas → Maya chat with open canvas system prompt
- [ ] Open Canvas Maya trigger phrase → generation → save → redirect
- [ ] `/api/campaigns/generate` generates valid JSON + saves to campaigns table
- [ ] Campaign detail page shows three-panel layout
- [ ] "Do this with Maya →" opens Maya chat with task context
- [ ] Week-by-week plan renders as collapsible week accordions
- [ ] Maya system prompt on campaign detail includes full campaign context
- [ ] My campaigns list at `/dashboard/campaigns` shows all user campaigns
- [ ] Campaign cards link to detail page
- [ ] Mode badge shows segment (guided) or "Custom campaign" (open canvas)
- [ ] Both modes produce same campaign artifact structure in DB


---

## Amendment — Model Selection (added May 30, 2026)

### Model selector UI

Add to Step 3 of Guided flow (below timeline/budget) and to Open Canvas
flow before Maya starts building (as a settings row above the chat input).

```tsx
const MODEL_OPTIONS = [
  {
    id:          'sonnet',
    model:       'anthropic/claude-sonnet-4',
    label:       'Claude Sonnet',
    description: 'Fast and capable — great for most campaigns',
    credits:     8,
  },
  {
    id:          'opus',
    model:       'anthropic/claude-opus-4',
    label:       'Claude Opus',
    description: 'Most powerful model — best for complex strategy',
    credits:     25,
  },
]

{/* Model selector */}
<div className="mt-6">
  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
    Generation quality
  </p>
  <div className="space-y-2">
    {MODEL_OPTIONS.map(opt => (
      <button
        key={opt.id}
        onClick={() => setSelectedModel(opt.id)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border
                    transition-colors text-left
                    ${selectedModel === opt.id
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 hover:border-gray-400'}`}
      >
        <div>
          <p className={`text-sm font-medium ${selectedModel === opt.id ? 'text-white' : 'text-gray-900'}`}>
            {opt.label}
          </p>
          <p className={`text-xs mt-0.5 ${selectedModel === opt.id ? 'text-gray-300' : 'text-gray-400'}`}>
            {opt.description}
          </p>
        </div>
        <span className={`text-xs font-medium ml-4 whitespace-nowrap
                          ${selectedModel === opt.id ? 'text-gray-300' : 'text-gray-500'}`}>
          {opt.credits} credits
        </span>
      </button>
    ))}
  </div>
</div>
```

Default selection: Claude Sonnet.

### Pass model to API

Add `model` and `credits` to the generate request body:

```typescript
// On submit:
const selectedOption = MODEL_OPTIONS.find(o => o.id === selectedModel)

await fetch('/api/campaigns/generate', {
  method: 'POST',
  body: JSON.stringify({
    ...campaignParams,
    model:   selectedOption.model,
    credits: selectedOption.credits,
  })
})
```

### Update `/api/campaigns/generate`

```typescript
// Use model from request body — no hardcoded model
const model = body.model ?? 'anthropic/claude-sonnet-4'

const result = await openRouterComplete({
  model,
  messages: [{ role: 'user', content: prompt }],
  max_tokens: 4000,
  temperature: 0.7,
})

// Deduct credits based on model selected
const credits = body.credits ?? 8
await deductCredits(profile.id, credits, `Campaign generation — ${model}`)

// Save model used to campaigns table
await supabase.from('campaigns').insert({
  ...campaignData,
  model_used: model,  // add this column
})
```

Add `model_used text` column to campaigns table:
```sql
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS model_used text;
```

### Open Canvas model selector

In `OpenCanvasFlow`, show the model selector above the chat input as a
persistent settings row — user can change it before Maya generates:

```tsx
<div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50">
  <span className="text-xs text-gray-500">Generation model</span>
  <div className="flex gap-2">
    {MODEL_OPTIONS.map(opt => (
      <button
        key={opt.id}
        onClick={() => setSelectedModel(opt.id)}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
                    ${selectedModel === opt.id
                      ? 'bg-black text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}
      >
        {opt.label} · {opt.credits}cr
      </button>
    ))}
  </div>
</div>
```

