import { createServiceClient } from '@/lib/supabase/server'
import { deductCredits, refundCredits } from '@/lib/credits'
import { imageCreditCost } from '@/lib/credits/actionCosts'
import type { RunTier } from '@/lib/agents/cost'
import {
  chargeAgentRun,
  createTask,
  saveAgentOutput,
  updateTaskStatus,
} from '@/lib/agents/runner'
import { resolveContentPostingFlow } from '@/lib/agents/contentPosting'
import { composeImageCaption } from './composeCaption'
import { assertPostAssetOwnedByProfile } from './generateOptions'
import type { TextQaResult } from './types'

/** One bundled charge for brief + options + QA + caption — debits by image model tier. */
export function generationBundleCreditCost(modelId: string | null | undefined, plan: string | null | undefined): number {
  return imageCreditCost(modelId, plan)
}

const BUNDLE_TIER: RunTier = 'deep'

export type QueueGeneratedPostInput = {
  profileId: string
  companyName: string
  taskInput: Record<string, unknown>
  priority?: string
  picked: {
    storagePath: string
    mime: string
    imageModel: string
    briefId: string
    optionIndex: number
    brief: string
    optionsCount: number
    qa: TextQaResult
  }
}

export type QueueGeneratedPostResult =
  | { ok: true; taskId: string; outputId: string; caption: string }
  | { ok: false; code: string; message: string; status: number }

/** Steps 5–6 — caption with image in context, then insert pending_approval output. */
export async function queueGeneratedPost(
  opts: QueueGeneratedPostInput,
): Promise<QueueGeneratedPostResult> {
  const { profileId, picked } = opts

  if (!picked.qa.passed) {
    return { ok: false, code: 'qa_not_passed', message: 'Text QA must pass before queueing.', status: 422 }
  }

  if (!assertPostAssetOwnedByProfile(picked.storagePath, profileId)) {
    return { ok: false, code: 'invalid_storage_path', message: 'Invalid image path.', status: 403 }
  }

  const taskInput = {
    ...opts.taskInput,
    contentFlow: 'single',
    media_storage_path: picked.storagePath,
    media_mime: picked.mime,
    image_caption_mode: true,
    generated_compose: true,
    generated_brief_id: picked.briefId,
    generated_option_index: picked.optionIndex,
    qa_passed: true,
    qa_transcription: picked.qa.transcription ?? undefined,
  }

  let taskId: string | null = null
  let creditsReserved = false
  let bundleCost = 0

  const supabase = createServiceClient()
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', profileId)
    .single()

  bundleCost = generationBundleCreditCost(picked.imageModel, profileRow?.plan ?? null)
  if (bundleCost < 0) {
    return {
      ok: false,
      code: 'premium_plan_required',
      message: 'Premium image models are available on ProAgent.',
      status: 403,
    }
  }

  try {
    const task = await createTask({
      userId: profileId,
      agent: 'content_posting',
      input: taskInput,
      triggerType: 'user',
      priority: opts.priority ?? 'normal',
    })
    taskId = task.id as string
    await updateTaskStatus(taskId, 'running')

    await deductCredits(
      profileId,
      bundleCost,
      'image_generation_bundle — reserved',
      taskId,
    )
    creditsReserved = true

    const { caption, inputTokens, outputTokens, model } = await composeImageCaption({
      profileId,
      companyName: opts.companyName,
      taskInput,
      storagePath: picked.storagePath,
      qaTranscription: picked.qa.transcription,
    })

    const dateLabel = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    const outputContent: Record<string, unknown> = {
      raw: caption,
      media_storage_path: picked.storagePath,
      media_mime: picked.mime,
      image_caption_mode: true,
      contentFlow: resolveContentPostingFlow(taskInput),
      generated: {
        model: picked.imageModel,
        brief_id: picked.briefId,
        options_count: picked.optionsCount,
        picked_index: picked.optionIndex,
        qa_passed: true,
        qa_method: picked.qa.qaMethod,
        caption_model: model,
      },
    }

    const output = await saveAgentOutput({
      taskId,
      userId: profileId,
      agent: 'content_posting',
      outputType: 'content_posting',
      title: `Post caption — ${dateLabel}`,
      content: outputContent,
    })

    await chargeAgentRun({
      taskId,
      userId: profileId,
      inputTokens,
      outputTokens,
      model,
      creditsAlreadyDeducted: true,
      tier: BUNDLE_TIER,
    })

    await updateTaskStatus(taskId, 'completed')

    return {
      ok: true,
      taskId,
      outputId: output.id as string,
      caption,
    }
  } catch (err) {
    if (taskId) await updateTaskStatus(taskId, 'failed').catch(() => {})
    if (creditsReserved && taskId) {
      await refundCredits(
        profileId,
        bundleCost,
        'image_generation_bundle — failed refund',
        taskId,
      ).catch(() => {})
    }

    const msg = err instanceof Error ? err.message : 'compose_failed'
    if (msg === 'INSUFFICIENT_CREDITS') {
      return { ok: false, code: 'INSUFFICIENT_CREDITS', message: msg, status: 402 }
    }

    console.error('[queueGeneratedPost]', err)
    return { ok: false, code: 'compose_failed', message: msg, status: 502 }
  }
}
