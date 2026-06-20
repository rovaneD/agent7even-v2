import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { runTextQaGate } from '@/lib/agents/imageGeneration/textQaGate'
import { assertPostAssetOwnedByProfile } from '@/lib/agents/imageGeneration/generateOptions'
import { isImageGenerationEnabled } from '@/lib/posts/imageGenerationFlag'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 60

type Body = {
  storagePath?: string
}

/** Step 4: vision read-back text QA on the user-picked generated image. */
export async function POST(req: Request) {
  if (!isImageGenerationEnabled()) {
    return NextResponse.json({ error: 'feature_disabled' }, { status: 404 })
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plan, company_name')
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

  const storagePath = body.storagePath?.trim()
  if (!storagePath) {
    return NextResponse.json({ error: 'storagePath required' }, { status: 400 })
  }

  if (!assertPostAssetOwnedByProfile(storagePath, profile.id)) {
    return NextResponse.json({ error: 'invalid_storage_path' }, { status: 403 })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'openrouter_not_configured' }, { status: 503 })
  }

  try {
    const qa = await runTextQaGate({
      profileId: profile.id,
      companyName: (profile.company_name as string | null) ?? 'your business',
      storagePath,
    })

    if (!qa.passed) {
      return NextResponse.json({ qa }, { status: 422 })
    }

    return NextResponse.json({ qa })
  } catch (err) {
    console.error('[generate-images/qa]', err)
    const msg = err instanceof Error ? err.message : 'qa_failed'
    return NextResponse.json({ error: 'qa_failed', message: msg }, { status: 502 })
  }
}
