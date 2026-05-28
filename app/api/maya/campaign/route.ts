/*
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text,
  plan jsonb,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table campaigns add column if not exists tasks jsonb default '[]';
*/

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, profile } = await req.json()

  const supabase = createServiceClient()

  // Look up profile UUID from clerk_user_id
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profileRow) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Verify campaigns table exists
  const { data: tableCheck, error: tableError } = await supabase.from('campaigns').select('id').limit(1)
  console.log('campaigns table check:', tableCheck, tableError)

  // Build conversation summary from user messages
  const conversationSummary = (messages as { role: string; content: string }[])
    .filter(m => m.role === 'user' && !m.content?.startsWith('__SYSTEM_INIT__'))
    .map(m => m.content)
    .join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system: `You are a senior marketing strategist. Based on the discovery conversation below, generate a complete, specific 30-day marketing plan.

BUSINESS CONTEXT:
- Company: ${profile.companyName ?? 'Not specified'}
- Type: ${profile.businessType ?? 'Not specified'}
- Ideal customer: ${profile.idealCustomer ?? 'Not specified'}
- Budget: ${profile.marketingBudget ?? 'Not specified'}
- Goals: ${Array.isArray(profile.topGoals) ? profile.topGoals.join(', ') : 'Not specified'}
- Challenge: ${profile.marketingChallenge ?? 'Not specified'}
- Sells via: ${Array.isArray(profile.sellLocations) ? profile.sellLocations.join(', ') : 'Not specified'}
- Competitors: ${Array.isArray(profile.competitors) && profile.competitors.length ? profile.competitors.join(', ') : 'None specified'}

OUTPUT FORMAT — return valid JSON only, no markdown, no preamble:
{
  "title": "30-day plan title specific to their business",
  "summary": "2-sentence executive summary",
  "weeks": [
    {
      "week": 1,
      "theme": "Week theme",
      "focus": "Primary focus area",
      "tasks": [
        {
          "day": "Mon",
          "action": "Specific action",
          "channel": "Instagram | Email | Website | Ads",
          "time_required": "30 mins",
          "priority": "high | medium | low"
        }
      ]
    }
  ],
  "quick_wins": ["3-5 things they can do today"],
  "metrics_to_track": ["4-6 specific KPIs"],
  "budget_allocation": {
    "organic_content": "X%",
    "paid_ads": "X%",
    "tools": "X%"
  }
}`,
    messages: [
      {
        role: 'user',
        content: `Here is the discovery conversation:\n\n${conversationSummary || 'No conversation yet — generate based on profile data only.'}\n\nGenerate the 30-day plan now.`,
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''

  let plan
  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/, '').trim()
    plan = JSON.parse(cleaned)
  } catch {
    console.error('Plan parse failed, raw:', raw.slice(0, 200))
    return NextResponse.json({ error: 'Plan generation failed' }, { status: 500 })
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      user_id: profileRow.id,
      title: plan.title,
      plan,
      status: 'active',
    })
    .select()
    .single()

  if (campaignError) {
    console.error('Campaign insert failed:', campaignError)
    // Still return the plan so the UI renders — just without a saved ID
    return NextResponse.json({ plan, campaign: null, error: 'Failed to save campaign' })
  }

  return NextResponse.json({ campaign, plan })
}
