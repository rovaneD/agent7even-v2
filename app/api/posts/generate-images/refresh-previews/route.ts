import { NextResponse } from 'next/server'
import { assertPostAssetOwnedByProfile } from '@/lib/agents/imageGeneration'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'

type Body = { storagePaths?: string[] }

/** Refresh signed preview URLs for stored generation options (session restore). */
export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspaceId } = ws

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const paths = (body.storagePaths ?? []).filter(p => typeof p === 'string' && p.trim())
  if (paths.length === 0) {
    return NextResponse.json({ previews: {} })
  }

  const previews: Record<string, string | null> = {}
  await Promise.all(
    paths.map(async path => {
      if (!assertPostAssetOwnedByProfile(path, workspaceId)) {
        previews[path] = null
        return
      }
      previews[path] = await createPostAssetSignedUrl(path, 3600)
    }),
  )

  return NextResponse.json({ previews })
}
