import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { VIDEO_TYPES } from '@/lib/agents/contentPosting/videoTypes'

/** Signed example clips for the video gallery tiles: { examples: { [typeId]: url } }. */
export async function GET() {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const entries = await Promise.all(
    VIDEO_TYPES.filter(t => t.examplePath).map(async t => [t.id, await createPostAssetSignedUrl(t.examplePath!, 60 * 60 * 6)] as const),
  )
  return NextResponse.json({ examples: Object.fromEntries(entries.filter(([, u]) => u)) })
}
