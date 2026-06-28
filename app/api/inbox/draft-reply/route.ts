import { auth } from '@clerk/nextjs/server'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { models } from '@/lib/ai/client'
import { loadFoundationContext } from '@/lib/agents/loadFoundationContext'
import { createTask, updateTaskStatus } from '@/lib/agents/runner'
import { deductCredits, refundCredits } from '@/lib/credits'
import { ACTION_CREDIT_COST } from '@/lib/credits/actionCosts'
import { assessTextFairUse } from '@/lib/credits/textFairUse'
import {
  buildInboxDraftReplyPrompt,
  type InboxDraftThreadMessage,
} from '@/lib/inbox/draftReply'

const DRAFT_MODEL = 'anthropic/claude-haiku-4-5'
const DRAFT_CREDITS = ACTION_CREDIT_COST.text_run

function parseThreadMessages(value: unknown): InboxDraftThreadMessage[] {
  if (!Array.isArray(value)) return []
  const out: InboxDraftThreadMessage[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const direction: InboxDraftThreadMessage['direction'] =
      row.direction === 'outgoing' ? 'outgoing' : 'incoming'
    const text = typeof row.text === 'string' ? row.text.trim() : ''
    if (!text) continue
    out.push({
      direction,
      text,
      senderName: typeof row.senderName === 'string' ? row.senderName : undefined,
    })
  }
  return out
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const channel = body.channel === 'comment' ? 'comment' : body.channel === 'dm' ? 'dm' : null
  const platform = typeof body.platform === 'string' ? body.platform.trim() : ''
  const threadMessages = parseThreadMessages(body.threadMessages)

  if (!channel || !platform || threadMessages.length === 0) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, plan')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile?.id) {
    return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  }

  const fairUse = await assessTextFairUse(profile.id)
  if (fairUse.warn) {
    console.warn('[inbox/draft-reply] text fair-use:', fairUse.message)
  }

  const foundation = await loadFoundationContext(profile.id)
  const { system, userMessage } = buildInboxDraftReplyPrompt({
    channel,
    platform,
    companyName: profile.company_name,
    participantName: typeof body.participantName === 'string' ? body.participantName : null,
    postPreview: typeof body.postPreview === 'string' ? body.postPreview : null,
    replyToComment: typeof body.replyToComment === 'string' ? body.replyToComment : null,
    threadMessages,
    foundation,
  })

  const task = await createTask({
    userId: profile.id,
    agent: 'maya',
    jobType: 'inbox_draft_reply',
    model: DRAFT_MODEL,
    input: { channel, platform },
  })
  await updateTaskStatus(task.id, 'running')

  try {
    await deductCredits(profile.id, DRAFT_CREDITS, `Inbox draft reply — task ${task.id}`, task.id)
  } catch (err) {
    await updateTaskStatus(task.id, 'failed').catch(() => {})
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }
    return NextResponse.json({ error: 'credit_deduction_failed' }, { status: 500 })
  }

  try {
    const result = await generateText({
      model: models.contentWriter,
      system,
      prompt: userMessage,
      maxOutputTokens: 280,
      temperature: 0.65,
    })

    const draft = result.text.trim().replace(/^["']|["']$/g, '')
    if (!draft) {
      throw new Error('empty_draft')
    }

    await updateTaskStatus(task.id, 'completed')
    return NextResponse.json({ draft })
  } catch (err) {
    await refundCredits(profile.id, DRAFT_CREDITS, `Inbox draft failed — task ${task.id} refund`, task.id).catch(() => {})
    await updateTaskStatus(task.id, 'failed').catch(() => {})
    console.error('[inbox/draft-reply] generation failed:', err)
    return NextResponse.json({ error: 'draft_failed' }, { status: 500 })
  }
}
