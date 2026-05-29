import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { convertToModelMessages } from 'ai'
import { createServiceClient } from '@/lib/supabase/server'
import { runAgent } from '@/lib/ai/runAgent'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages: rawMessages, isEdit, priorOption, canvasContext } = await req.json()
  const converted = await convertToModelMessages(rawMessages as Parameters<typeof convertToModelMessages>[0])

  if (!converted?.length) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
  }

  const MODE_PROMPTS: Record<string, string> = {
    'Build a campaign': 'The user wants to build a 30-day marketing campaign. Start by confirming their primary goal for this month based on what you know from their foundation. Ask one clarifying question to get started.',
    'Create content': 'The user wants to create marketing content. Ask them what type of content they need today — caption, email, ad copy, or something else. Keep it to one question.',
    'Analyze my marketing': 'The user wants to analyze their marketing performance. Ask them what channel or campaign they want to review first.',
    'Just talk to Maya': 'The user wants an open conversation. Greet them warmly and ask what is on their mind today regarding their marketing.',
  }

  // Extract mode/task from messages; replace sentinels with neutral openers
  // so the instruction goes into the system prompt, not the user turn.
  let modeInstruction = ''
  const messages = converted.map(msg => {
    if (msg.role !== 'user') return msg
    const text = Array.isArray(msg.content)
      ? msg.content.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('')
      : typeof msg.content === 'string' ? msg.content : ''
    if (text.startsWith('__MODE__')) {
      const selectedMode = text.replace(/^__MODE__/, '').replace(/__$/, '')
      console.log('[maya/chat] Mode detected:', selectedMode)
      modeInstruction = MODE_PROMPTS[selectedMode] ?? ''
      return { ...msg, content: "Let's get started." }
    }
    if (text.startsWith('__TASK__')) {
      const task = text.replace(/^__TASK__/, '').replace(/__$/, '').trim()
      console.log('[maya/chat] Task detected:', task)
      modeInstruction = `The user wants to complete this specific marketing task right now: "${task}"

Execute it immediately. Do not ask clarifying questions unless absolutely necessary.
Draft the actual deliverable — copy, content, or plan — based on what you know about their business.
Show 2-3 variations if it's copy. Be specific to their brand voice and audience.

You are completing a specific task, not building a new campaign. Never say "spinning up the Campaign Builder" during a task session. If the user asks to save or update the campaign, confirm it has been saved and continue refining the current task.`
      return { ...msg, content: "Let's do this." }
    }
    return msg
  })

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

  console.log('[maya/chat] Profile found:', profile?.id, profile?.company_name)

  let brief = '', icp = '', positioning = '', voice = ''

  if (profile) {
    const { data: docs, error: docsError } = await supabase
      .from('foundation_documents')
      .select('type, markdown')
      .eq('user_id', profile.id)

    if (docsError) console.error('[maya/chat] foundation_documents error:', docsError.message)
    console.log('[maya/chat] Foundation docs found:', docs?.length, docs?.map(d => d.type))

    brief       = docs?.find(d => d.type === 'brief')?.markdown       ?? ''
    icp         = docs?.find(d => d.type === 'icp')?.markdown         ?? ''
    positioning = docs?.find(d => d.type === 'positioning')?.markdown ?? ''
    voice       = docs?.find(d => d.type === 'voice')?.markdown       ?? ''
  }

  const hasFoundation = !!(brief || icp || positioning || voice)
  console.log('[maya/chat] hasFoundation:', hasFoundation)

  const companyName   = profile?.company_name    || 'this business'
  const businessType  = profile?.business_type   || 'not specified'
  const idealCustomer = profile?.ideal_customer  || 'not specified'
  const sellVia       = profile?.sell_locations?.length ? profile.sell_locations.join(', ') : 'not specified'
  const budget        = profile?.marketing_budget || 'not specified'
  const goals         = profile?.top_goals?.length ? profile.top_goals.join(', ') : 'not specified'
  const challenge     = profile?.marketing_challenge || 'not specified'
  const comfort       = profile?.content_comfort || 'not specified'
  const watchList     = profile?.competitors?.length ? profile.competitors.map((c: string) => `@${c}`).join(', ') : 'none yet'
  const website       = profile?.website_url || 'not provided'
  const instagram     = profile?.instagram_handle ? `@${profile.instagram_handle}` : 'not provided'

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

  // Mode instruction is appended to the system prompt — never replaces foundation context.
  const modeSection = modeInstruction
    ? `\nYOUR TASK FOR THIS SESSION:\n${modeInstruction}`
    : ''

  const editSection = isEdit
    ? `\nEDIT MODE:\nThe user is revisiting a previously completed task to improve it. Do not start from scratch — acknowledge what they chose before and ask what they want to change. Be brief and direct.${priorOption ? `\nTheir previous selection: "${priorOption}"` : ''}`
    : ''

  const canvasSection = canvasContext
    ? `\nCANVAS CONTEXT:\nThe user is currently on the ${canvasContext} page. Tailor your responses to be relevant to what they're looking at.`
    : ''

  const system = `You are Maya, a marketing strategist at Agent7even. You help small businesses build marketing that actually works.

${contextSection}
${canvasSection}
HOW YOU OPEN:
Your very first message must demonstrate you already know their business. Reference something specific — their goal, their challenge, their differentiator. Make them feel seen.

Bad: "What kind of business do you run?"
Good: "Okay — your goal this month is to get your first 10 customers. With Instagram as your main channel and a $200–$500 budget, here's where I'd start: what does your current content look like?"
${modeSection}${editSection}

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
