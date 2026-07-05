import { NextResponse } from 'next/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import {
  assertPostAssetOwnedByProfile,
  regenerateImageOption,
  TEXT_QA_MAX_REGENERATE_RETRIES,
} from '@/lib/agents/imageGeneration'
import { sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'
import { isImageGenerationEnabled } from '@/lib/posts/imageGenerationFlag'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 120

type Body = {
  briefId?: string
  optionIndex?: number
  brief?: string
  retryCount?: number
  imageModel?: string
}

/** Regenerate one image option after QA failure (bounded retries). */
export async function POST(req: Request) {
  if (!isImageGenerationEnabled()) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 404 })
  }

  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId, profile } = ws
  if (!profile.plan) return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { briefId, optionIndex, brief, retryCount = 0 } = body
  if (!briefId || typeof optionIndex !== 'number' || optionIndex < 0 || !brief?.trim()) {
    return NextResponse.json({ error: 'briefId, optionIndex, and brief required' }, { status: 400 })
  }

  if (retryCount >= TEXT_QA_MAX_REGENERATE_RETRIES) {
    return NextResponse.json(
      {
        error: 'max_regenerate_retries',
        message: `Maximum ${TEXT_QA_MAX_REGENERATE_RETRIES} regenerations reached for this option.`,
      },
      { status: 429 },
    )
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'openrouter_not_configured' }, { status: 503 })
  }

  try {
    const option = await regenerateImageOption({
      profileId: workspaceId,
      briefId,
      optionIndex,
      brief: brief.trim(),
      imageModel: body.imageModel,
    })

    if (!assertPostAssetOwnedByProfile(option.storagePath, workspaceId)) {
      return NextResponse.json({ error: 'upload_failed' }, { status: 500 })
    }

    return NextResponse.json({ option })
  } catch (err) {
    console.error('[generate-images/regenerate-option]', err)
    const msg = err instanceof Error ? err.message : 'regenerate_failed'
    return NextResponse.json(
      {
        error: 'regenerate_failed',
        message: sanitizeUserFacingError(msg, 'image_regenerate'),
      },
      { status: 502 },
    )
  }
}
