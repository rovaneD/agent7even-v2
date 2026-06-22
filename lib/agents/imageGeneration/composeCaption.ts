import { generateText } from 'ai'
import { openrouter } from '@/lib/ai/client'
import { buildSystemPrompt } from '@/lib/agents/runner'
import { buildAgentFlowPrompt, buildAgentUserMessage } from '@/lib/agents/flows'
import {
  buildImageCaptionSystemAddon,
  buildVisionUserMessageFromStorage,
  platformCharLimit,
  primaryPlatformFromInput,
  VISION_CAPTION_MODEL,
} from '@/lib/agents/visionCaption'
import { looksLikeWeeklyContentPlan } from '@/lib/agents/contentPosting'

function buildQaTranscriptionAddon(qaTranscription: string | null | undefined): string {
  const text = qaTranscription?.trim()
  if (!text) return ''
  return `\n\nQA READ-BACK — visible text detected in this Maya-generated image:
"${text.slice(0, 500)}${text.length > 500 ? '…' : ''}"

Write a caption that complements what is actually shown. Do not quote garbled or misspelled text from the image verbatim.`
}

/** Step 5 — vision caption with chosen generated image + optional QA transcription (§2d). */
export async function composeImageCaption(opts: {
  profileId: string
  companyName: string
  taskInput: Record<string, unknown>
  storagePath: string
  qaTranscription?: string | null
}): Promise<{
  caption: string
  inputTokens: number
  outputTokens: number
  model: string
}> {
  const agentId = 'content_posting' as const
  const taskInput = {
    ...opts.taskInput,
    contentFlow: 'single',
    media_storage_path: opts.storagePath,
    image_caption_mode: true,
  }

  const [baseSystem, flowSystem] = await Promise.all([
    buildSystemPrompt(opts.profileId, agentId, taskInput),
    buildAgentFlowPrompt(opts.profileId, agentId, taskInput),
  ])

  const platform = primaryPlatformFromInput(taskInput)
  let system = [baseSystem, flowSystem].filter(Boolean).join('\n\n---\n\n')
  system += `\n\n${buildImageCaptionSystemAddon({
    companyName: opts.companyName,
    platform,
    charLimit: platformCharLimit(platform),
  })}`
  system += buildQaTranscriptionAddon(opts.qaTranscription)
  system += `\n\nOUTPUT OVERRIDE: Return a single social caption only. Ignore any multi-day plan or multi-post output contract.`

  let userMessage = buildAgentUserMessage(agentId, taskInput)
  userMessage += buildQaTranscriptionAddon(opts.qaTranscription)

  const visionContent = await buildVisionUserMessageFromStorage({
    textInstruction: userMessage,
    storagePath: opts.storagePath,
  })

  const result = await generateText({
    model: openrouter(VISION_CAPTION_MODEL),
    system,
    messages: [{ role: 'user', content: visionContent }],
    maxOutputTokens: 800,
    temperature: 0.4,
  })

  const caption = result.text.trim()
  if (!caption) throw new Error('empty_caption')
  if (looksLikeWeeklyContentPlan(caption)) throw new Error('caption_looks_like_weekly_plan')

  return {
    caption,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    model: VISION_CAPTION_MODEL,
  }
}
