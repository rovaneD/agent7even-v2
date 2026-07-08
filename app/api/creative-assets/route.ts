import { NextResponse } from 'next/server'
import { assertPostAssetOwnedByProfile } from '@/lib/agents/imageGeneration'
import { listCreativeAssets, saveCreativeAsset } from '@/lib/creativeAssets'
import { createServiceClient } from '@/lib/supabase/server'
import { requireWorkspaceDataUserId } from '@/lib/profiles/workspaceSession'

type SaveBody = {
  storagePath?: string
  mime?: string
  briefId?: string
  optionIndex?: number
  imageModel?: string
  imageModelLabel?: string
  briefExcerpt?: string
  brief?: string
  qaPassed?: boolean
  postContext?: Record<string, unknown>
}

export async function GET() {
  const supabase = createServiceClient()
  const workspaceId = await requireWorkspaceDataUserId(supabase)
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assets = await listCreativeAssets(workspaceId)
  return NextResponse.json({ assets })
}

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const workspaceId = await requireWorkspaceDataUserId(supabase)
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: SaveBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { storagePath, mime } = body
  if (!storagePath?.trim() || !mime?.trim()) {
    return NextResponse.json({ error: 'storagePath and mime required' }, { status: 400 })
  }

  if (!assertPostAssetOwnedByProfile(storagePath.trim(), workspaceId)) {
    return NextResponse.json({ error: 'invalid_path' }, { status: 403 })
  }

  const result = await saveCreativeAsset({
    profileId: workspaceId,
    storagePath: storagePath.trim(),
    mime: mime.trim(),
    briefId: body.briefId ?? null,
    optionIndex: body.optionIndex ?? null,
    imageModel: body.imageModel ?? null,
    imageModelLabel: body.imageModelLabel ?? null,
    briefExcerpt: body.briefExcerpt ?? null,
    brief: body.brief ?? body.briefExcerpt ?? null,
    qaPassed: body.qaPassed ?? null,
    postContext: body.postContext ?? null,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.code === 'table_missing' ? 503 : 500 },
    )
  }

  return NextResponse.json({ success: true, asset: result.asset })
}
