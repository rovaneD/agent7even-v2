import { NextResponse } from 'next/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { runTextQaGate } from '@/lib/agents/imageGeneration/textQaGate'
import { sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'
import { assertPostAssetOwnedByProfile } from '@/lib/agents/imageGeneration/generateOptions'
import { isImageGenerationEnabled } from '@/lib/posts/imageGenerationFlag'
import { createServiceClient } from '@/lib/supabase/server'
import { hasPlatformAccess } from '@/lib/plans'

export const maxDuration = 90

type Body = {
  storagePath?: string
  brief?: string
  expectedHeadline?: string
}

/** Step 4: vision read-back text QA on the user-picked generated image. */
export async function POST(req: Request) {
  if (!isImageGenerationEnabled()) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 404 })
  }

  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId, profile } = ws
  if (!hasPlatformAccess(profile.plan, profile.status, profile.billing_exempt ?? false)) {
    return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const storagePath = body.storagePath?.trim()
  if (!storagePath) {
    return NextResponse.json({ error: 'storagePath required' }, { status: 400 })
  }

  if (!assertPostAssetOwnedByProfile(storagePath, workspaceId)) {
    return NextResponse.json({ error: 'invalid_storage_path' }, { status: 403 })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'openrouter_not_configured' }, { status: 503 })
  }

  try {
    const qa = await runTextQaGate({
      profileId: workspaceId,
      companyName: (profile.company_name as string | null) ?? 'your business',
      storagePath,
      brief: body.brief?.trim() || null,
      expectedHeadline: body.expectedHeadline?.trim() || null,
    })

    if (!qa.passed) {
      return NextResponse.json({ qa }, { status: 422 })
    }

    return NextResponse.json({ qa })
  } catch (err) {
    console.error('[generate-images/qa]', err)
    const msg = err instanceof Error ? err.message : 'qa_failed'
    return NextResponse.json(
      {
        error: 'qa_failed',
        message: sanitizeUserFacingError(msg, 'image_qa'),
      },
      { status: 502 },
    )
  }
}
