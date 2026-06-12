import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { convertToModelMessages, streamText } from 'ai'
import { createServiceClient } from '@/lib/supabase/server'
import { models } from '@/lib/ai/client'
import { logActivity } from '@/lib/activity'
import { createTask, updateTaskStatus } from '@/lib/agents/runner'
import { calculateCost, CREDIT_COST } from '@/lib/agents/cost'
import { loadFoundationContext } from '@/lib/agents/loadFoundationContext'
import { deductCredits, refundCredits } from '@/lib/credits'
import { buildImageContextCapabilityPrompt } from '@/lib/posts/imageContextCapabilities'

const CHAT_CREDITS = CREDIT_COST.light  // 2 credits per turn
const MAYA_MODEL   = 'anthropic/claude-sonnet-4'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages: rawMessages, isEdit, priorOption, canvasContext, canvasData, isOpenCanvas, isHelpMode, attachments } = await req.json()
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
    if (text === '__HELP__') {
      modeInstruction = 'Respond EXACTLY with this message and nothing else: "What can I help you with? I can walk you through any part of Maya."'
      return { ...msg, content: 'Hi, I need some help.' }
    }
    if (text === '__PAGE_CONTEXT__') {
      modeInstruction = `The user opened Maya from the page they are currently working on. Use the PAGE CONTEXT/CANVAS CONTEXT below as your primary frame.

Start by naming the page or workflow they are in and offer the most useful next-step help for that exact screen. Do not show the generic Maya mode menu. Do not ask what business they run. Ask one practical question that helps them get a better outcome from the current page.`
      return { ...msg, content: "I'm working on this page." }
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

  if (profile?.id) logActivity(profile.id, 'maya_message').catch(() => {})

  // ── 2. Cost tracking — runs regardless of foundation status ───────────────
  // Task creation and credit deduction happen here, before foundation fetch,
  // so a missing/empty foundation never prevents cost recording.
  if (profile?.id) {
    // ── 3. Load Foundation context ─────────────────────────────────────────
    // profile.id is the Supabase UUID — same key as foundation_answers + foundation_documents.
    // Do NOT branch on foundation_complete; that flag is unreliable (can be true with 0 docs).
    const foundation = await loadFoundationContext(profile.id)
    const { hasFoundation, documents, competitorsFreetext, answers: fAnswers } = foundation

    // ── 4. Build system prompt ─────────────────────────────────────────────
    const companyName = profile?.company_name || 'this business'
    const website     = profile?.website_url || 'not provided'
    const instagram   = profile?.instagram_handle ? `@${profile.instagram_handle}` : 'not provided'
    // Competitors: answers.competitors freetext — profiles.competitors array is unreliable
    const watchList   = competitorsFreetext || 'none yet'

    const hasGeneratedDocs = Object.values(documents).some(v => v.length > 0)

    const contextSection = hasGeneratedDocs
      ? `You have already built this business's foundation. Here is everything you know:

BUSINESS BRIEF:
${documents.brief}

IDEAL CUSTOMER PROFILE:
${documents.icp}

POSITIONING:
${documents.positioning}

BRAND VOICE:
${documents.voice}

Never ask for information covered above. Reference specific details in your opening — goals, frustrations, differentiators. Make the user feel like you've been thinking about their business before they said a word.`
      : hasFoundation
        ? `You have all the context you need about this business from their Foundation answers:

BUSINESS:
${fAnswers.businessDescription || '—'}

PROBLEM THEY SOLVE:
${fAnswers.problemSolved || '—'}

IDEAL CUSTOMER:
${fAnswers.customerWho || '—'}

THEIR FRUSTRATION:
${fAnswers.customerFrustration || '—'}

DIFFERENTIATOR:
${fAnswers.differentiator || '—'}${fAnswers.differentiatorOwn ? `\nIn their words: ${fAnswers.differentiatorOwn}` : ''}

TONE:
${fAnswers.toneTraits || '—'}

COMPETITORS:
${watchList}

GOAL THIS MONTH:
${fAnswers.monthlyGoal || '—'}

Never ask for information covered above. Reference specific details in your opening — goals, frustrations, differentiators. Make the user feel like you've been thinking about their business before they said a word.`
        : `WHAT YOU KNOW ABOUT THIS BUSINESS:
- Company: ${companyName}
- Website: ${website}
- Instagram: ${instagram}

Reference these specifics. Ask one focused question to learn more about their business.`

    const modeSection = modeInstruction
      ? `\nYOUR TASK FOR THIS SESSION:\n${modeInstruction}`
      : ''

    const editSection = isEdit
      ? `\nEDIT MODE:\nThe user is revisiting a previously completed task to improve it. Do not start from scratch — acknowledge what they chose before and ask what they want to change. Be brief and direct.${priorOption ? `\nTheir previous selection: "${priorOption}"` : ''}`
      : ''

    const canvasSection = canvasData
      ? `\nPAGE CONTEXT — what the user is currently looking at:\n${canvasData}`
      : canvasContext
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

    const helpSection = isHelpMode ? `
PRODUCT KNOWLEDGE — AGENT7EVEN MAYA PLATFORM:

NAVIGATION SECTIONS:
- Dashboard: Overview of campaigns, morning digest, agent activity, and quick stats
- Agents: 9 automated marketing agents. Run them manually, schedule them, or review their queued outputs in the approval queue. Each agent has a "What NOT to do" constraints field for brand safety.
- Campaigns: Two creation modes — Guided (3 steps: pick audience segment → set goal → set timeline/budget) or Open Canvas (chat with Maya → she asks questions → generates the full plan). Each campaign has a "Do this today" action list and a week-by-week schedule. Click "Do this with Maya →" on any task to get help executing it.
- Services: Add-on work from the Agent7even team (design, web, photography, etc.). Browse, request, and track status.
- Content Calendar: Week-by-week content plan generated from campaigns. Shows platform, content type, estimated time.
- Foundation: One-time business setup — 5 steps collecting business description, customer profile, positioning, brand voice, and 30-day goals. Generates 5 documents Maya uses for every agent run and campaign. Edit answers at any time and re-score.
- Brand Kit: 6 sections — Identity (logos, tagline), Colors (palette), Typography (fonts), Imagery (photo style), Voice (brand documents), Templates (Canva/Figma links). Maya can generate color palettes and font pairings.
- Analytics: Connect Google Analytics (OAuth) and Meta Ads (OAuth) to see sessions, traffic sources, spend, reach, and ROAS.
- Deliverables: Files uploaded by the Agent7even team for your projects. Download via signed URLs.
- Support: Threaded support tickets with priority levels. Maya can help draft support messages.
- Notifications: Real-time activity feed — agent completions, approvals, deliverables, plan changes.
- Team: Invite team members, set per-module permissions (billing, analytics, etc.), manage seats.
- Billing: Your plan (Starter/Growth/ProAgent), credit balance, top-up credits, invoice history, Stripe portal.
- Settings: Company name, website, Instagram handle, notification preferences.

HOW CREDITS WORK:
Credits are the currency for running agents and chatting with Maya. Your plan includes a monthly allowance: Starter 100cr, Growth 350cr, ProAgent 1,000cr. Maya chat costs 2 credits per message. Agent runs cost 2–25 credits based on complexity. Top up mid-month from the Billing page. A low-balance modal appears when you drop below 20%.

HOW FOUNDATION WORKS:
Foundation is a 5-step setup that collects deep business context — description, customer profile, positioning, brand voice, 30-day goals. When complete, it generates 5 documents that Maya uses for every agent run and campaign. A higher Foundation score means better, more specific output. You can always edit answers and re-score at /dashboard/foundation.

THE APPROVAL QUEUE:
Some agents (like Campaign Builder and Brand Voice Guardian) require approval before their output is saved. These outputs appear in Agents → Approvals. You can expand each item, edit it, approve it, or reject it with a reason (rejection feeds back to Maya as training signal).

IMAGE-CONTEXT CAPTIONS (Weekly Content):
${buildImageContextCapabilityPrompt()}

YOUR ROLE IN HELP MODE:
You are a helpful guide for the Maya platform. Answer questions about how to use any feature. Be specific, direct, and practical. Walk users through exact steps. Do not talk about pricing unless asked. Do not speculate about features that don't exist. If someone asks how to do something, give them the literal steps — not vague suggestions.
` : ''

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
Never use emoji in your responses. Use plain text only.
${helpSection}
${contextSection}
${canvasSection}${foundationSection}
HOW YOU OPEN:
One sentence. Pick one specific thing you know — their goal, their main challenge, or their differentiator — and lead with it. Then ask one direct question. Do not summarize or recite their foundation back at them. Do not list everything you know.

Bad: "I know you're running [company] — you're targeting [customer] who are [frustration] and you position yourself as [differentiator]..."
Bad: "What kind of business do you run?"
Good: "Your goal this month is your first 10 customers — what does your current Instagram look like?"
${modeSection}${editSection}${openCanvasSection}

RESPONSE LENGTH — CRITICAL:
Maximum 3 sentences per reply. Stop. Never output more than 4 sentences before pausing for a response.

${isOpenCanvas || isHelpMode ? '' : `WHEN TO ORCHESTRATE — after 4–6 meaningful exchanges:
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
    await updateTaskStatus(task.id, 'running')

    try {
      await deductCredits(profile.id, CHAT_CREDITS, `Maya chat — task ${task.id}`, task.id)
    } catch (err) {
      await updateTaskStatus(task.id, 'failed').catch(() => {})
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'INSUFFICIENT_CREDITS') {
        return NextResponse.json(
          { error: 'INSUFFICIENT_CREDITS', message: 'Maya needs credits to respond. Choose a plan or top up credits to continue.' },
          { status: 402 },
        )
      }
      console.error('[maya/chat] credit deduction failed:', err)
      return NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 })
    }

    // Inject file/image attachment parts into the last user message
    type AttachmentInput = { url: string; name: string; mimeType: string }
    const attachmentList: AttachmentInput[] = Array.isArray(attachments) ? attachments : []
    const finalMessages = attachmentList.length
      ? (() => {
          const lastUserIdx = messages.reduce((acc: number, msg: { role: string }, i: number) => msg.role === 'user' ? i : acc, -1)
          if (lastUserIdx < 0) return messages
          return messages.map((msg: { role: string; content: unknown }, i: number) => {
            if (i !== lastUserIdx) return msg
            const existing: unknown[] = Array.isArray(msg.content)
              ? [...(msg.content as unknown[])]
              : [{ type: 'text', text: typeof msg.content === 'string' ? msg.content : '' }]
            for (const att of attachmentList) {
              if (att.mimeType?.startsWith('image/')) {
                existing.push({ type: 'image', image: new URL(att.url) })
              } else if (att.mimeType === 'application/pdf') {
                existing.push({ type: 'file', data: new URL(att.url), mimeType: 'application/pdf' })
              } else {
                existing.push({ type: 'text', text: `\n[Attached file: "${att.name}" — ${att.url}]` })
              }
            }
            return { ...msg, content: existing }
          })
        })()
      : messages

    let result: Awaited<ReturnType<typeof streamText>>
    try {
      result = await streamText({ model: models.maya, system, messages: finalMessages as typeof messages, maxOutputTokens: 2000 })
    } catch (err) {
      await refundCredits(profile.id, CHAT_CREDITS, `Maya chat failed — task ${task.id} refund`, task.id).catch(() => {})
      await updateTaskStatus(task.id, 'failed').catch(() => {})
      console.error('[maya/chat] stream failed:', err)
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
    }

    const taskId = task.id

    waitUntil((async () => {
      try {
        const usage        = await result.usage
        const inputTokens  = usage.inputTokens  ?? 0
        const outputTokens = usage.outputTokens ?? 0

        const costUsd = await calculateCost(MAYA_MODEL, inputTokens, outputTokens)

        const now = new Date().toISOString()
        const { error: taskErr } = await supabase
          .from('agent_tasks')
          .update({
            status:        'completed',
            input_tokens:  inputTokens,
            output_tokens: outputTokens,
            cost_usd:      costUsd,
            updated_at:    now,
            completed_at:  now,
          })
          .eq('id', taskId)
        if (taskErr) console.error('[maya/chat] agent_tasks update error:', taskErr.message)

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
  const fallback = await streamText({
    model: models.maya,
    system: 'You are Maya, a marketing strategist at Agent7even.',
    messages,
    maxOutputTokens: 2000,
  })
  return fallback.toUIMessageStreamResponse()
}
