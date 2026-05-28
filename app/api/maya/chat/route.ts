import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { convertToModelMessages } from 'ai'
import { createServiceClient } from '@/lib/supabase/server'
import { runAgent } from '@/lib/ai/runAgent'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages: rawMessages } = await req.json()
  const messages = await convertToModelMessages(rawMessages as Parameters<typeof convertToModelMessages>[0])

  if (!messages?.length) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Try full select first; fall back to basic fields if extended columns don't exist yet
  let profile: Record<string, any> | null = null
  const { data: fullProfile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id, company_name, business_type,
      ideal_customer, sell_locations, marketing_budget,
      competitors, top_goals, marketing_challenge, content_comfort,
      website_url, instagram_handle
    `)
    .eq('clerk_user_id', userId)
    .single()

  if (profileError) {
    console.error('[maya/chat] full profile fetch error:', profileError.code, profileError.message)
    // Fall back to guaranteed-safe columns
    const { data: basicProfile, error: basicError } = await supabase
      .from('profiles')
      .select('id, company_name, business_type, website_url, instagram_handle')
      .eq('clerk_user_id', userId)
      .single()
    if (basicError) console.error('[maya/chat] basic profile fetch error:', basicError.code, basicError.message)
    profile = basicProfile
  } else {
    profile = fullProfile
  }

  console.log('[maya/chat] profile:', JSON.stringify({
    id: profile?.id?.slice(0, 8),
    company_name: profile?.company_name,
    business_type: profile?.business_type,
    ideal_customer: profile?.ideal_customer,
    marketing_budget: profile?.marketing_budget,
    top_goals: profile?.top_goals,
  }))

  let brief = '', icp = '', positioning = '', voice = ''

  console.log('[maya/chat] profile from DB:', JSON.stringify({
    id: profile?.id,
    company_name: profile?.company_name,
    business_type: profile?.business_type,
    ideal_customer: profile?.ideal_customer,
    marketing_budget: profile?.marketing_budget,
    top_goals: profile?.top_goals,
  }))

  if (profile) {
    const { data: docs, error: docsError } = await supabase
      .from('foundation_documents')
      .select('type, markdown')
      .eq('user_id', profile.id)

    if (docsError) console.log('[maya/chat] foundation_documents error:', docsError.message)
    console.log('[maya/chat] foundation docs found:', docs?.map(d => d.type))

    brief       = docs?.find(d => d.type === 'brief')?.markdown       ?? ''
    icp         = docs?.find(d => d.type === 'icp')?.markdown         ?? ''
    positioning = docs?.find(d => d.type === 'positioning')?.markdown ?? ''
    voice       = docs?.find(d => d.type === 'voice')?.markdown       ?? ''
  }

  const hasFoundation = !!(brief || icp || positioning || voice)

  const companyName  = profile?.company_name    || 'this business'
  const businessType = profile?.business_type   || 'not specified'
  const idealCustomer= profile?.ideal_customer  || 'not specified'
  const sellVia      = profile?.sell_locations?.length ? profile.sell_locations.join(', ') : 'not specified'
  const budget       = profile?.marketing_budget || 'not specified'
  const goals        = profile?.top_goals?.length ? profile.top_goals.join(', ') : 'not specified'
  const challenge    = profile?.marketing_challenge || 'not specified'
  const comfort      = profile?.content_comfort || 'not specified'
  const watchList    = profile?.competitors?.length ? profile.competitors.map((c: string) => `@${c}`).join(', ') : 'none yet'
  const website      = profile?.website_url || 'not provided'
  const instagram    = profile?.instagram_handle ? `@${profile.instagram_handle}` : 'not provided'

  const contextSection = hasFoundation
    ? `You have already built this business's foundation. Here is everything you know:

BUSINESS BRIEF:
${brief}

IDEAL CUSTOMER PROFILE:
${icp}

POSITIONING:
${positioning}

BRAND VOICE:
${voice}

Never ask for information covered above. Reference specific details in your opening — goals, frustrations, differentiators. Make the user feel like you've been thinking about their business before they said a word.`
    : `WHAT YOU KNOW ABOUT THIS BUSINESS:
- Company: ${companyName}
- Type: ${businessType}
- Ideal customer: ${idealCustomer}
- Sells via: ${sellVia}
- Monthly budget: ${budget}
- Goals: ${goals}
- Biggest challenge: ${challenge}
- Content comfort: ${comfort}
- Competitors: ${watchList}
- Website: ${website}
- Instagram: ${instagram}

Reference these specifics in your opening. Never ask for information already listed above.`

  const system = `You are Maya, a marketing strategist at Agent7even. You help small businesses build marketing that actually works.

${contextSection}

HOW YOU OPEN:
Your very first message must demonstrate you already know their business. Reference something specific — their goal, their challenge, their differentiator. Make them feel seen.

Bad: "What kind of business do you run?"
Good: "Okay — your goal this month is to get your first 10 customers. With Instagram as your main channel and a $200–$500 budget, here's where I'd start: what does your current content look like?"

RESPONSE LENGTH — CRITICAL:
Maximum 3 sentences per reply. Stop. Never output more than 4 sentences before pausing for a response.

WHEN TO ORCHESTRATE — after 4–6 meaningful exchanges:
Say exactly: "Got everything I need. I'm spinning up the Campaign Builder now — it'll have your full 30-day plan ready in about a minute."
This exact phrase triggers the Campaign Builder. Only use it when you genuinely have enough context.

PERSONALITY:
Direct. Warm. A little energetic. Never say "Great!" or "Absolutely!" Just respond and move.
Never use markdown in conversation. Save structure for the plan.`

  return runAgent({ agent: 'maya', system, messages })
}
