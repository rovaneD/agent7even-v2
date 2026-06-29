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
import { assessTextFairUse } from '@/lib/credits/textFairUse'
import { buildAgentFlowPrompt, buildAgentUserMessage } from '@/lib/agents/flows'
import { formatAgentRunDateLong, normalizeSeoScanReportDate } from '@/lib/agents/runMetadata'
import { parseAndValidateIdeaAnalysis } from '@/lib/agents/ideaAnalysis'
import { readPostMediaRef } from '@/lib/postAssets'
import {
  buildImageCaptionSystemAddon,
  buildVisionUserMessageFromStorage,
  platformCharLimit,
  primaryPlatformFromInput,
  VISION_CAPTION_MODEL,
} from '@/lib/agents/visionCaption'

export type ExecuteAgentRunResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

/** Run an agent task in-process (used by dispatch + internal run route). */
export async function executeAgentRun(opts: {
  agentId: AgentId
  taskId: string
  userId: string
  taskInput: Record<string, unknown>
}): Promise<ExecuteAgentRunResult> {
  const { agentId, taskId, userId } = opts
  const taskInput = opts.taskInput ?? {}
  const agent = AGENTS[agentId]

  if (!agent) {
    if (taskId) await updateTaskStatus(taskId, 'failed').catch(() => {})
    return { ok: false, status: 400, error: `Unknown agent: ${agentId}` }
  }

  if (!taskId) {
    return { ok: false, status: 400, error: 'taskId required' }
  }

  const media = readPostMediaRef(taskInput)
  const hasImage = Boolean(media.media_storage_path && media.media_mime)
  const singlePostRun = isSinglePostRun(agentId, taskInput)

  if (singlePostRun && !hasImage) {
    await updateTaskStatus(taskId, 'failed').catch(() => {})
    return {
      ok: false,
      status: 400,
      error: 'Single post requires an attached image. Re-attach your image and run again.',
    }
  }

  const supabase = createServiceClient()
  const { data: taskRow } = await supabase
    .from('agent_tasks')
    .select('user_id')
    .eq('id', taskId)
    .single()

  if (!taskRow || taskRow.user_id !== userId) {
    return { ok: false, status: 404, error: 'Not found' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name')
    .eq('id', userId)
    .single()

  await updateTaskStatus(taskId, 'running')
  const tier: RunTier = hasImage ? 'deep' : 'light'
  const creditsNeeded = CREDIT_COST[tier]
  let creditsReserved = false

  if (creditsNeeded === 0) {
    const fairUse = await assessTextFairUse(userId)
    if (fairUse.warn) {
      console.warn(`[executeAgentRun/${agentId}] text fair-use:`, fairUse.message)
    }
  }

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
      const visionContent = await buildVisionUserMessageFromStorage({
        textInstruction: userMessage,
        storagePath: media.media_storage_path,
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
      const maxTokens = agentId === 'idea_analysis' ? 2500 : 2000
      const result = await generateText({
        model: openrouter(modelId),
        system,
        messages: [{ role: 'user', content: userMessage }],
        maxOutputTokens: maxTokens,
      })
      text = result.text
      usage = result.usage
    }

    let trimmedText = text.trim()

    if (agentId === 'seo_scanner') {
      const scanDate = formatAgentRunDateLong()
      trimmedText = normalizeSeoScanReportDate(trimmedText, scanDate)
    }

    const outputContent: Record<string, unknown> = { raw: trimmedText }

    if (agentId === 'idea_analysis') {
      const validation = parseAndValidateIdeaAnalysis(trimmedText)
      if (!validation.ok) {
        throw new Error(`idea_analysis_invalid: ${validation.error}`)
      }
      outputContent.parsed = validation.data
      outputContent.raw = JSON.stringify(validation.data, null, 2)
    }
    if (agentId === 'content_posting') {
      outputContent.contentFlow = resolveContentPostingFlow(taskInput)
    }
    if (hasImage && media.media_storage_path) {
      outputContent.media_storage_path = media.media_storage_path
      outputContent.media_mime = media.media_mime
      if (singlePostRun) {
        outputContent.image_caption_mode = true
      }
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
    return { ok: true }
  } catch (err) {
    await updateTaskStatus(taskId, 'failed').catch(() => {})
    if (creditsReserved) {
      await refundCredits(userId, creditsNeeded, `agent_run — ${agentId} failed refund`, taskId).catch(() => {})
    }
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'INSUFFICIENT_CREDITS') {
      return { ok: false, status: 402, error: 'INSUFFICIENT_CREDITS' }
    }
    console.error(`[executeAgentRun/${agentId}]`, err)
    return { ok: false, status: 500, error: String(err) }
  }
}
