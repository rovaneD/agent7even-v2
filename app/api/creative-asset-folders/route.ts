import { NextResponse } from 'next/server'
import { createCreativeAssetFolder, listCreativeAssetFolders } from '@/lib/creativeAssets'
import { createServiceClient } from '@/lib/supabase/server'
import { requireWorkspaceDataUserId } from '@/lib/profiles/workspaceSession'

export async function GET() {
  const supabase = createServiceClient()
  const workspaceId = await requireWorkspaceDataUserId(supabase)
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const folders = await listCreativeAssetFolders(workspaceId)
  return NextResponse.json({ folders })
}

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const workspaceId = await requireWorkspaceDataUserId(supabase)
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const result = await createCreativeAssetFolder(workspaceId, body.name ?? '')
  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.code === 'table_missing' ? 503 : 400 },
    )
  }

  return NextResponse.json({ folder: result.folder })
}
