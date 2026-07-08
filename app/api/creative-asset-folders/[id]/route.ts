import { NextResponse } from 'next/server'
import { deleteCreativeAssetFolder } from '@/lib/creativeAssets'
import { createServiceClient } from '@/lib/supabase/server'
import { requireWorkspaceDataUserId } from '@/lib/profiles/workspaceSession'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = createServiceClient()
  const workspaceId = await requireWorkspaceDataUserId(supabase)
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ok = await deleteCreativeAssetFolder(workspaceId, id)
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 })

  return NextResponse.json({ success: true })
}
