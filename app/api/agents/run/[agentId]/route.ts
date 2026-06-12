import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openrouter } from '@/lib/ai/client'
import { createServiceClient } from '@/lib/supabase/server'
import { deductCredits, refundCredits } from '@/lib/credits'
import {
  updateTaskStatus,
  saveAgentOutput,
  buildSystemPrompt,
  chargeAgentRun,
} from '@/lib/agents/runner'
import { isSinglePostRun, isWeeklyContentRun, resolveContentPostingFlow } from '@/lib/agents/contentPosting'
import { AGENTS, type AgentId } from '@/lib/agents/registry'
import { CREDIT_COST, type RunTier } from '@/lib/agents/cost'
import { buildAgentFlowPrompt, buildAgentUserMessage } from '@/lib/agents/flows'
import {
  buildImageCaptionSystemAddon,
  buildVisionUserMessage,
  platformCharLimit,
  primaryPlatformFromInput,
  VISION_CAPTION_MODEL,
} from '@/lib/agents/visionCaption'
import { createPostAssetSignedUrl, readPostMediaRef } from '@/lib/postAssets'

export const maxDuration = 120

export async function POST(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const secret = process.env.INTERNAL_JOB_SECRET
  if (!secret || req.headers.get('x-internal-secret') !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { agentId: rawAgentId } = await params
  const { taskId, input } = await req.json()

  const agentId = rawAgentId.replace(/-/g, '_') as AgentId
  const agent = AGENTS[agentId]

  if (!agent) {
    if (taskId) await updateTaskStatus(taskId, 'failed').catch(() => {})
    return NextResponse.json({ error: `Unknown agent: ${rawAgentId}` }, { status: 400 })
  }

  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  const userId = input.userId as string
  const taskInput = (input ?? {}) as Record<string, unknown>
  const media = readPostMediaRef(taskInput)
  const hasImage = Boolean(media.media_storage_path && media.media_mime)
  const singlePostRun = isSinglePostRun(agentId, taskInput)

  if (singlePostRun && !hasImage) {
    await updateTaskStatus(taskId, 'failed').catch(() => {})
    return NextResponse.json(
      { error: 'Single post requires an attached image. Re-attach your image and run again.' },
      { status: 400 },
    )
  }

  const supabase = createServiceClient()
  const { data: taskRow } = await supabase
    .from('agent_tasks')
    .select('user_id')
    .eq('id', taskId)
    .single()

  if (!taskRow || taskRow.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name')
    .eq('id', userId)
    .single()

  await updateTaskStatus(taskId, 'running')
  const tier: RunTier = hasImage || singlePostRun ? 'standard' : 'light'
  const creditsNeeded = CREDIT_COST[tier]
  let creditsReserved = false

  try {
    await deductCredits(userId, creditsNeeded, `agent_run — ${agentId} reserved`, taskId)
    creditsReserved = true

    const [baseSystem, flowSystem] = await Promise.all([
      buildSystemPrompt(userId, agentId, taskInput),
      buildAgentFlowPrompt(userId, agentId, taskInput),
    ])

    let system = [baseSystem, flowSystem].filter(Boolean).join('\n\n---\n\n')

    if (taskInput.rejection_feedback) {
      system += `\n\nIMPORTANT — Previous version was rejected with this feedback: "${taskInput.rejection_feedback}". Address this directly before anything else.`
    }

    const userMessage = buildAgentUserMessage(agentId, taskInput)
    const modelId = hasImage ? VISION_CAPTION_MODEL : agent.model

    if (hasImage) {
      const platform = primaryPlatformFromInput(taskInput)
      system += `\n\n${buildImageCaptionSystemAddon({
        companyName: (profile?.company_name as string | null) ?? 'your business',
        platform,
        charLimit: platformCharLimit(platform),
      })}`
    }

    if (hasImage || isSinglePostRun(agentId, taskInput)) {
      system += `\n\nOUTPUT OVERRIDE: Return a single social caption only. Ignore any multi-day plan or multi-post output contract.`
    }

    let text: string
    let usage: { inputTokens?: number; outputTokens?: number }

    if (hasImage && media.media_storage_path) {
      const signedUrl = await createPostAssetSignedUrl(media.media_storage_path, 3600)
      if (!signedUrl) throw new Error('image_url_failed')

      const visionContent = buildVisionUserMessage({
        textInstruction: userMessage,
        imageUrl: signedUrl,
      })

      const result = await generateText({
        model: openrouter(modelId),
        system,
        messages: [{ role: 'user', content: visionContent }],
        maxOutputTokens: 800,
      })
      text = result.text
      usage = result.usage
    } else {
      const result = await generateText({
        model: openrouter(modelId),
        system,
        messages: [{ role: 'user', content: userMessage }],
        maxOutputTokens: 2000,
      })
      text = result.text
      usage = result.usage
    }

    const outputContent: Record<string, unknown> = { raw: text.trim() }
    if (agentId === 'content_posting') {
      outputContent.contentFlow = resolveContentPostingFlow(taskInput)
    }
    if (hasImage && media.media_storage_path) {
      outputContent.media_storage_path = media.media_storage_path
      outputContent.media_mime = media.media_mime
      outputContent.image_caption_mode = true
    }

    const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const outputTitle = hasImage || isSinglePostRun(agentId, taskInput)
      ? `Post caption — ${dateLabel}`
      : isWeeklyContentRun(agentId, taskInput)
        ? `Weekly content plan — ${dateLabel}`
        : `${agent.name} — ${dateLabel}`

    await saveAgentOutput({
      taskId,
      userId,
      agent: agentId,
      outputType: agent.outputType,
      title: outputTitle,
      content: outputContent,
    })

    await chargeAgentRun({
      taskId,
      userId,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      model: modelId,
      creditsAlreadyDeducted: true,
      tier,
    })

    await updateTaskStatus(taskId, 'completed')
    return NextResponse.json({ success: true })

  } catch (err) {
    await updateTaskStatus(taskId, 'failed').catch(() => {})
    if (creditsReserved) {
      await refundCredits(userId, creditsNeeded, `agent_run — ${agentId} failed refund`, taskId).catch(() => {})
    }
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }
    console.error(`[agents/run/${agentId}]`, err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
