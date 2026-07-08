import { NextResponse } from 'next/server'
import {
  deleteCreativeAsset,
  getCreativeAssetById,
  updateCreativeAsset,
} from '@/lib/creativeAssets'
import { createServiceClient } from '@/lib/supabase/server'
import { requireWorkspaceDataUserId } from '@/lib/profiles/workspaceSession'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = createServiceClient()
  const workspaceId = await requireWorkspaceDataUserId(supabase)
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const asset = await getCreativeAssetById(workspaceId, id)
  if (!asset) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ asset })
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = createServiceClient()
  const workspaceId = await requireWorkspaceDataUserId(supabase)
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { isFavorite?: boolean; folderId?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (body.isFavorite === undefined && body.folderId === undefined) {
    return NextResponse.json({ error: 'no_updates' }, { status: 400 })
  }

  const ok = await updateCreativeAsset(workspaceId, id, {
    isFavorite: body.isFavorite,
    folderId: body.folderId,
  })
  if (!ok) return NextResponse.json({ error: 'update_failed' }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = createServiceClient()
  const workspaceId = await requireWorkspaceDataUserId(supabase)
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ok = await deleteCreativeAsset(workspaceId, id)
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 })

  return NextResponse.json({ success: true })
}
