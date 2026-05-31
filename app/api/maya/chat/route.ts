import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { convertToModelMessages, streamText } from 'ai'
import { createServiceClient } from '@/lib/supabase/server'
import { models } from '@/lib/ai/client'
import { logActivity } from '@/lib/activity'
import { createTask, updateTaskStatus } from '@/lib/agents/runner'
import { calculateCost, CREDIT_COST } from '@/lib/agents/cost'

const CHAT_CREDITS = CREDIT_COST.light  // 2 credits per turn
const MAYA_MODEL   = 'anthropic/claude-sonnet-4'

export async function POST(req: Request) {
  console.log('[maya/chat] 1. route hit')
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages: rawMessages, isEdit, priorOption, canvasContext, isOpenCanvas } = await req.json()
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
      modeInstruction = MODE_PROMPTS[selectedMode] ?? ''
      return { ...msg, content: "Let's get started." }
    }
    if (text.startsWith('__TASK__')) {
      const task = text.replace(/^__TASK__/, '').replace(/__$/, '').trim()
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

  // ── 1. Fetch profile ───────────────────────────────────────────────────────
  // Use .limit(1) + array index instead of .single() so duplicate rows (PGRST116)
  // don't cause both fetches to fail and drop the request to the no-profile path.
  let profile: Record<string, any> | null = null
  const { data: fullRows, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id, company_name, business_type,
      ideal_customer, sell_locations, marketing_budget,
      competitors, top_goals, marketing_challenge, content_comfort,
      website_url, instagram_handle, foundation_score
    `)
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (profileError) {
    console.error('[maya/chat] full profile fetch error:', profileError.code, profileError.message)
    const { data: basicRows, error: basicError } = await supabase
      .from('profiles')
      .select('id, company_name, business_type, website_url, instagram_handle')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
    if (basicError) console.error('[maya/chat] basic profile fetch error:', basicError.code, basicError.message)
    profile = basicRows?.[0] ?? null
  } else {
    profile = fullRows?.[0] ?? null
  }

  console.log('[maya/chat] 2. profile id:', profile?.id ?? 'NONE')
  if (profile?.id) logActivity(profile.id, 'maya_message').catch(() => {})

  // ── 2. Cost tracking — runs regardless of foundation status ───────────────
  // Task creation and credit deduction happen here, before foundation fetch,
  // so a missing/empty foundation never prevents cost recording.
  if (profile?.id) {
    const { data: bal, error: balError } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('user_id', profile.id)
      .single()

    console.log('[maya/chat] 3. balance:', bal?.balance ?? `NO ROW (${balError?.message})`)

    if ((bal?.balance ?? 0) < CHAT_CREDITS) {
      console.log('[maya/chat] INSUFFICIENT_CREDITS — returning 402')
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }

    // ── 3. Fetch foundation docs (for system prompt only) ──────────────────
    let brief = '', icp = '', positioning = '', voice = ''
    const { data: docs, error: docsError } = await supabase
      .from('foundation_documents')
      .select('type, markdown')
      .eq('user_id', profile.id)
    if (docsError) console.error('[maya/chat] foundation_documents error:', docsError.message)

    brief       = docs?.find(d => d.type === 'brief')?.markdown       ?? ''
    icp         = docs?.find(d => d.type === 'icp')?.markdown         ?? ''
    positioning = docs?.find(d => d.type === 'positioning')?.markdown ?? ''
    voice       = docs?.find(d => d.type === 'voice')?.markdown       ?? ''

    const hasFoundation = !!(brief || icp || positioning || voice)
    console.log('[maya/chat] hasFoundation:', hasFoundation)

    // ── 4. Build system prompt ─────────────────────────────────────────────
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

    const modeSection = modeInstruction
      ? `\nYOUR TASK FOR THIS SESSION:\n${modeInstruction}`
      : ''

    const editSection = isEdit
      ? `\nEDIT MODE:\nThe user is revisiting a previously completed task to improve it. Do not start from scratch — acknowledge what they chose before and ask what they want to change. Be brief and direct.${priorOption ? `\nTheir previous selection: "${priorOption}"` : ''}`
      : ''

    const canvasSection = canvasContext
      ? `\nCANVAS CONTEXT:\nThe user is currently on the ${canvasContext} page. Tailor your responses to be relevant to what they're looking at.`
      : ''

    const foundationScore = (profile as { foundation_score?: number | null } | null)?.foundation_score ?? null
    const foundationSection = foundationScore !== null
      ? `\nFOUNDATION SCORE: ${foundationScore}%${
          foundationScore < 70
            ? `\nThe user's foundation answers are ${foundationScore}% complete. If it's relevant to the conversation and hasn't been mentioned recently, gently note that improving their Foundation answers would improve everything you create for them — they can edit at /dashboard/foundation.`
            : ''
        }`
      : ''

    const openCanvasSection = isOpenCanvas
      ? `
OPEN CANVAS MODE:
The user is building a custom campaign from scratch. They have a specific situation, idea, or problem.
Your job:
1. Ask smart questions to understand their situation — one question at a time
2. Help them think through the problem and opportunity
3. Propose a campaign approach that fits their unique case
4. When you have gathered enough detail, offer to build the full plan

When you have enough information to generate the campaign, say EXACTLY:
"I have what I need to build this. Want me to generate the full plan?"

Do NOT say this until you have: what they're promoting, who the audience is, and what success looks like.
`
      : ''

    const system = `You are Maya, a marketing strategist at Agent7even. You help small businesses build marketing that actually works.

${contextSection}
${canvasSection}${foundationSection}
HOW YOU OPEN:
Your very first message must demonstrate you already know their business. Reference something specific — their goal, their challenge, their differentiator. Make them feel seen.

Bad: "What kind of business do you run?"
Good: "Okay — your goal this month is to get your first 10 customers. With Instagram as your main channel and a $200–$500 budget, here's where I'd start: what does your current content look like?"
${modeSection}${editSection}${openCanvasSection}

RESPONSE LENGTH — CRITICAL:
Maximum 3 sentences per reply. Stop. Never output more than 4 sentences before pausing for a response.

${isOpenCanvas ? '' : `WHEN TO ORCHESTRATE — after 4–6 meaningful exchanges:
Say exactly: "Got everything I need. I'm spinning up the Campaign Builder now — it'll have your full 30-day plan ready in about a minute."
This exact phrase triggers the Campaign Builder. Only use it when you genuinely have enough context.

`}PERSONALITY:
Direct. Warm. A little energetic. Never say "Great!" or "Absolutely!" Just respond and move.
Never use markdown in conversation. Save structure for the plan.`

    // ── 5. Create task, stream, record cost ────────────────────────────────
    const task = await createTask({
      userId:  profile.id,
      agent:   'maya',
      jobType: 'maya_chat',
      model:   MAYA_MODEL,
      input:   { messageCount: messages.length },
    })
    console.log('[maya/chat] 4. task created:', task.id)
    await updateTaskStatus(task.id, 'running')

    const result = await streamText({ model: models.maya, system, messages, maxOutputTokens: 2000 })
    console.log('[maya/chat] 5. stream starting')

    const profileId      = profile.id
    const taskId         = task.id
    const currentBalance = bal?.balance ?? 0

    waitUntil((async () => {
      console.log('[maya/chat] 6. waitUntil fired, task:', taskId)
      try {
        const usage        = await result.usage
        const inputTokens  = usage.inputTokens  ?? 0
        const outputTokens = usage.outputTokens ?? 0
        console.log('[maya/chat] 7. tokens:', inputTokens, outputTokens)

        const costUsd = await calculateCost(MAYA_MODEL, inputTokens, outputTokens)
        console.log('[maya/chat] 8. cost recorded:', costUsd)

        const { error: taskErr } = await supabase
          .from('agent_tasks')
          .update({
            status:        'completed',
            input_tokens:  inputTokens,
            output_tokens: outputTokens,
            cost_usd:      costUsd,
            updated_at:    new Date().toISOString(),
          })
          .eq('id', taskId)
        if (taskErr) console.error('[maya/chat] agent_tasks update error:', taskErr.message)

        const newBalance = currentBalance - CHAT_CREDITS
        const { error: balErr } = await supabase
          .from('credit_balances')
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq('user_id', profileId)
        if (balErr) console.error('[maya/chat] credit_balances update error:', balErr.message)

        const { error: ledgerErr } = await supabase.from('credit_ledger').insert({
          user_id:       profileId,
          type:          'usage',
          credits:       -CHAT_CREDITS,
          balance_after: newBalance,
          description:   `Maya chat — task ${taskId}`,
          task_id:       taskId,
        })
        if (ledgerErr) console.error('[maya/chat] credit_ledger insert error:', ledgerErr.message)

        console.log('[maya/chat] 9. credits deducted, new balance:', newBalance)
      } catch (err) {
        console.error('[maya/chat] post-stream recording failed:', err)
        void supabase
          .from('agent_tasks')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', taskId)
      }
    })())

    return result.toUIMessageStreamResponse()
  }

  // ── Fallback: no profile — stream without cost tracking (should not happen) ─
  console.log('[maya/chat] WARNING: no profile found for userId:', userId)
  const fallback = await streamText({
    model: models.maya,
    system: 'You are Maya, a marketing strategist at Agent7even.',
    messages,
    maxOutputTokens: 2000,
  })
  return fallback.toUIMessageStreamResponse()
}
