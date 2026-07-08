import { NextResponse } from 'next/server'
import { assertPostAssetOwnedByProfile } from '@/lib/agents/imageGeneration'
import { downloadPostAsset } from '@/lib/postAssets'
import { mimeFromFilename, sanitizeFilename } from '@/lib/postAssetLimits'
import { requireWorkspaceDataUserId } from '@/lib/profiles/workspaceSession'
import { createServiceClient } from '@/lib/supabase/server'

type Body = {
  storagePath?: string
  filename?: string
  mime?: string
}

/** Download an owned post-assets file (generated images, uploads, saved assets). */
export async function POST(req: Request) {
  const supabase = createServiceClient()
  const workspaceId = await requireWorkspaceDataUserId(supabase)
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const bytes = await downloadPostAsset(storagePath)
  if (!bytes) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const rawName = body.filename?.trim() || storagePath.split('/').pop() || 'image.png'
  const filename = sanitizeFilename(rawName)
  const mime = body.mime?.trim() || mimeFromFilename(filename)

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
