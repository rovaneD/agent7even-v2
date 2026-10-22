import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { assertPostAssetOwnedByProfile } from '@/lib/agents/imageGeneration/generateOptions'
import { CAST_CREATORS, isCreatorTraits } from '@/lib/agents/contentPosting/creators'
import { deductCredits } from '@/lib/credits'
import { ACTION_CREDIT_COST } from '@/lib/credits/actionCosts'

type SavedRow = { id: string; name: string; traits: unknown; photo_path: string; created_at: string }

/** Our cast + this workspace's own creators, with 1h signed photo URLs. */
export async function GET() {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cast = await Promise.all(
    CAST_CREATORS.map(async c => ({
      id: c.id,
      name: c.name,
      gender: c.gender,
      age: c.age,
      look: c.look,
      photoUrl: await createPostAssetSignedUrl(c.photoPath, 60 * 60),
    })),
  )

  let mine: Array<{ id: string; name: string; photoUrl: string | null; createdAt: string }> = []
  const { data, error } = await supabase
    .from('video_creators')
    .select('id,name,traits,photo_path,created_at')
    .eq('user_id', ws.workspaceId)
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(50)
  if (!error && data) {
    mine = await Promise.all(
      (data as SavedRow[]).map(async r => ({
        id: r.id,
        name: r.name,
        photoUrl: await createPostAssetSignedUrl(r.photo_path, 60 * 60),
        createdAt: r.created_at,
      })),
    )
  }

  return NextResponse.json({ cast, mine, saveCredits: ACTION_CREDIT_COST.image_standard })
}

/**
 * Save a "Create your own" pick. Charges the standard image price once, on save — the same rule as
 * image posts (options are free to look at; the one you keep is charged).
 */
export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { name?: string; traits?: unknown; photoPath?: string }
  const name = (body.name ?? '').trim().slice(0, 40)
  if (!name) return NextResponse.json({ error: 'name_required', message: 'Give your creator a name.' }, { status: 422 })
  if (!body.photoPath || !assertPostAssetOwnedByProfile(body.photoPath, ws.workspaceId)) {
    return NextResponse.json({ error: 'photo_required' }, { status: 422 })
  }
  const traits = isCreatorTraits(body.traits) ? body.traits : {}

  const cost = ACTION_CREDIT_COST.image_standard
  const { data: bal } = await supabase.from('credit_balances').select('balance').eq('user_id', ws.workspaceId).maybeSingle()
  if (Number(bal?.balance ?? 0) < cost) {
    return NextResponse.json(
      { error: 'insufficient_credits', message: `Saving a creator uses ${cost} credits. Credits refresh with your plan each month.` },
      { status: 402 },
    )
  }

  const { data, error } = await supabase
    .from('video_creators')
    .insert({ user_id: ws.workspaceId, name, traits, photo_path: body.photoPath })
    .select('id,name,photo_path,created_at')
    .single()
  if (error || !data) {
    console.error('[creators] save failed', error?.message)
    return NextResponse.json({ error: 'save_failed', message: 'Could not save the creator. Nothing was charged.' }, { status: 500 })
  }
  await deductCredits(ws.workspaceId, cost, `Creator saved: ${name}`)

  return NextResponse.json({
    creator: { id: data.id, name: data.name, photoUrl: await createPostAssetSignedUrl(data.photo_path, 60 * 60), createdAt: data.created_at },
  })
}

/** Archive one of this workspace's creators (?id=). */
export async function DELETE(req: Request) {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })
  await supabase.from('video_creators').update({ archived: true }).eq('id', id).eq('user_id', ws.workspaceId)
  return NextResponse.json({ ok: true })
}
