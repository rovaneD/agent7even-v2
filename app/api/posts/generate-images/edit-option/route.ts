import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import {
  assertPostAssetOwnedByProfile,
  editImageOption,
} from '@/lib/agents/imageGeneration'
import { sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'
import { isImageGenerationEnabled } from '@/lib/posts/imageGenerationFlag'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 120

type Body = {
  briefId?: string
  optionIndex?: number
  brief?: string
  editInstruction?: string
  imageModel?: string
  sourceStoragePath?: string
  editMode?: 'text-only' | 'visual'
}

/** User-directed revision of one generated option (e.g. swap subject, fix headline text). */
export async function POST(req: Request) {
  if (!isImageGenerationEnabled()) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 404 })
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plan')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (!profile.plan) {
    return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { briefId, optionIndex, brief, editInstruction, sourceStoragePath } = body
  if (
    !briefId
    || typeof optionIndex !== 'number'
    || optionIndex < 0
    || !brief?.trim()
    || !editInstruction?.trim()
    || !sourceStoragePath?.trim()
  ) {
    return NextResponse.json(
      { error: 'briefId, optionIndex, brief, editInstruction, and sourceStoragePath required' },
      { status: 400 },
    )
  }

  if (!assertPostAssetOwnedByProfile(sourceStoragePath.trim(), profile.id)) {
    return NextResponse.json({ error: 'invalid_storage_path' }, { status: 403 })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'openrouter_not_configured' }, { status: 503 })
  }

  try {
    const option = await editImageOption({
      profileId: profile.id,
      briefId,
      optionIndex,
      brief: brief.trim(),
      editInstruction: editInstruction.trim(),
      imageModel: body.imageModel,
      sourceStoragePath: sourceStoragePath.trim(),
      editMode: body.editMode,
    })

    if (!assertPostAssetOwnedByProfile(option.storagePath, profile.id)) {
      return NextResponse.json({ error: 'upload_failed' }, { status: 500 })
    }

    return NextResponse.json({ option })
  } catch (err) {
    console.error('[generate-images/edit-option]', err)
    const msg = err instanceof Error ? err.message : 'edit_failed'
    const friendly =
      msg === 'image_too_large_for_api'
        ? 'Image is too large for the edit API. Try Fix text only mode.'
        : sanitizeUserFacingError(msg, 'image_edit')
    return NextResponse.json({ error: 'edit_failed', message: friendly }, { status: 502 })
  }
}
