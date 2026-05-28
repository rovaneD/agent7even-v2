import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { convertToModelMessages } from 'ai'
import { createServiceClient } from '@/lib/supabase/server'
import { runAgent } from '@/lib/ai/runAgent'

interface Profile {
  companyName: string
  businessType: string
  idealCustomer?: string
  sellLocations?: string[]
  marketingBudget?: string
  topGoals?: string[]
  marketingChallenge?: string
  contentComfort?: string
  competitors?: string[]
  websiteUrl?: string
  instagramHandle?: string
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages: rawMessages, profile }: { messages: unknown[]; profile: Profile } = await req.json()
  const messages = await convertToModelMessages(rawMessages as Parameters<typeof convertToModelMessages>[0])

  if (!messages?.length) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
  }

  const p = profile ?? {}

  // Fetch foundation documents for richer context
  const supabase = createServiceClient()
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  let brief = '', icp = '', positioning = '', voice = ''

  if (profileRow) {
    const { data: foundationDocs } = await supabase
      .from('foundation_documents')
      .select('type, markdown')
      .eq('user_id', profileRow.id)

    brief = foundationDocs?.find(d => d.type === 'brief')?.markdown ?? ''
    icp = foundationDocs?.find(d => d.type === 'icp')?.markdown ?? ''
    positioning = foundationDocs?.find(d => d.type === 'positioning')?.markdown ?? ''
    voice = foundationDocs?.find(d => d.type === 'voice')?.markdown ?? ''
  }

  const hasFoundation = !!(brief || icp || positioning || voice)

  const sellVia = p.sellLocations?.length ? p.sellLocations.join(', ') : 'not specified'
  const goals = p.topGoals?.length ? p.topGoals.join(', ') : 'not specified'
  const watchList = p.competitors?.length ? p.competitors.map(c => `@${c}`).join(', ') : 'none yet'

  const foundationSection = hasFoundation ? `
You have already built this business's foundation. Here is what you know:

BUSINESS BRIEF:
${brief}

IDEAL CUSTOMER PROFILE:
${icp}

POSITIONING:
${positioning}

BRAND VOICE:
${voice}

You know this business deeply. Never ask for information covered in these documents. Your opening message should reference something specific from what you know.` : `
WHAT YOU KNOW:
- Business: ${p.companyName || 'this business'}
- Industry/type: ${p.businessType || 'not specified'}
- Ideal customer: ${p.idealCustomer || 'not specified'}
- They sell via: ${sellVia}
- Monthly marketing budget: ${p.marketingBudget || 'not specified'}
- Their top goals this month: ${goals}
- Biggest marketing challenge: ${p.marketingChallenge || 'not specified'}
- Content comfort: ${p.contentComfort || 'not specified'}
- Competitors to watch: ${watchList}
- Website: ${p.websiteUrl || 'not provided'}
- Instagram: ${p.instagramHandle ? `@${p.instagramHandle}` : 'not provided'}`

  const system = `You are Maya, a marketing strategist at Agent7even. You help small businesses build marketing that actually works.

You already know everything about this business. Never ask for information you already have.
${foundationSection}

HOW YOU OPEN:
Your very first response should demonstrate you already know their business. Reference something specific — their goal, their challenge, their budget. Make them feel like you've been thinking about their business.

Bad opening: "What kind of business do you run?"
Good opening: "Okay — you want to launch a product and build your email list this month. With a $200–$500 budget, here's where I'd start: tell me about the product you're launching."

RESPONSE LENGTH — THIS IS CRITICAL:
In conversation: maximum 3 sentences. Then stop. Never output more than 4 sentences before pausing.

WHEN TO ORCHESTRATE — after 4–6 meaningful exchanges when you have enough context:
Say exactly: "Got everything I need. I'm spinning up the Campaign Builder now — it'll have your full 30-day plan ready in about a minute."
This exact phrasing triggers the Campaign Builder agent. Use it only when you genuinely have enough to build a real plan.

HOW YOU HANDLE COMPETITORS:
Reference competitors from what you know when relevant.

PERSONALITY:
Direct. Warm. A little energetic. Never say "Great!" or "Absolutely!" Just respond and move.
Never use markdown in conversational replies. Save structure for the plan only.`

  return runAgent({ agent: 'maya', system, messages })
}
