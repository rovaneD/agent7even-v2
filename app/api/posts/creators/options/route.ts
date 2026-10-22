import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { hasPlatformAccess } from '@/lib/plans'
import { requestImagesEndpoint } from '@/lib/agents/imageGeneration/openRouterImage'
import { createPostAssetSignedUrl, uploadPostAsset } from '@/lib/postAssets'
import { ACTION_CREDIT_COST } from '@/lib/credits/actionCosts'
import { buildCreatorPrompt, CREATOR_OPTIONS_COUNT, isCreatorTraits } from '@/lib/agents/contentPosting/creators'

export const maxDuration = 120

const CREATOR_IMAGE_MODEL = 'openai/gpt-image-2.5-flare'

function sniffMime(b: Buffer): { mime: string; ext: string } {
  if (b[0] === 0x89 && b[1] === 0x50) return { mime: 'image/png', ext: 'png' }
  if (b[0] === 0xff && b[1] === 0xd8) return { mime: 'image/jpeg', ext: 'jpg' }
  return { mime: 'image/webp', ext: 'webp' }
}

/**
 * "Create your own": two photo options from the picked traits. Nothing is charged here — saving the
 * one you keep is charged (POST /api/posts/creators). Balance is checked first so nobody generates
 * options they can't save.
 */
export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId, profile } = ws
  if (!hasPlatformAccess(profile.plan, profile.status, profile.billing_exempt ?? false)) {
    return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { traits?: unknown }
  if (!isCreatorTraits(body.traits)) return NextResponse.json({ error: 'traits_required' }, { status: 422 })
  if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: 'openrouter_not_configured' }, { status: 503 })

  const cost = ACTION_CREDIT_COST.image_standard
  const { data: bal } = await supabase.from('credit_balances').select('balance').eq('user_id', workspaceId).maybeSingle()
  if (Number(bal?.balance ?? 0) < cost) {
    return NextResponse.json(
      { error: 'insufficient_credits', message: `Saving a creator uses ${cost} credits and your balance is ${Number(bal?.balance ?? 0)}.` },
      { status: 402 },
    )
  }

  const prompt = buildCreatorPrompt(body.traits)
  const results = await Promise.all(
    Array.from({ length: CREATOR_OPTIONS_COUNT }, async (_, i) => {
      try {
        const { bytes } = await requestImagesEndpoint(CREATOR_IMAGE_MODEL, prompt, '9:16', [], '1K')
        const { mime, ext } = sniffMime(bytes)
        const { storagePath } = await uploadPostAsset({ profileId: workspaceId, filename: `creator-option-${Date.now()}-${i + 1}.${ext}`, mime, bytes })
        return { photoPath: storagePath, photoUrl: await createPostAssetSignedUrl(storagePath, 60 * 60) }
      } catch (err) {
        console.error('[creators/options]', err instanceof Error ? err.message : err)
        return null
      }
    }),
  )
  const options = results.filter((r): r is { photoPath: string; photoUrl: string | null } => r !== null)
  if (!options.length) {
    return NextResponse.json({ error: 'generation_failed', message: 'Maya could not make the photos this time. Nothing was charged — try again.' }, { status: 502 })
  }
  return NextResponse.json({ options })
}
