import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { createPostAssetSignedUrl, downloadPostAsset } from '@/lib/postAssets'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { VIDEO_TYPES } from '@/lib/agents/contentPosting/videoTypes'
import { posterFrame } from '@/lib/agents/videoGeneration/assemble'

export const maxDuration = 60

/** Make the example's still frame once (stored next to the clip), so tiles don't download the video. */
async function ensurePoster(supabase: ReturnType<typeof createServiceClient>, videoPath: string): Promise<string | null> {
  const posterPath = `${videoPath}.jpg`
  const existing = await createPostAssetSignedUrl(posterPath, 60 * 60 * 6)
  if (existing) {
    const head = await fetch(existing, { method: 'HEAD' }).catch(() => null)
    if (head?.ok) return existing
  }
  const video = await downloadPostAsset(videoPath)
  const jpg = video ? await posterFrame(video) : null
  if (!jpg) return null
  const { error } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(posterPath, jpg, { contentType: 'image/jpeg', upsert: true })
  return error ? null : createPostAssetSignedUrl(posterPath, 60 * 60 * 6)
}

/**
 * Example clips for the video gallery: { examples: { [typeId]: url }, posters: { [typeId]: url } }.
 * Tiles show the poster and only play the clip on hover; the create panel plays it (Supabase egress,
 * 2026-10-29: autoplaying every example everywhere re-downloaded ~10 MB clips on each visit).
 */
export async function GET() {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const withExamples = VIDEO_TYPES.filter(t => t.examplePath)
  const entries = await Promise.all(
    withExamples.map(async t => [t.id, await createPostAssetSignedUrl(t.examplePath!, 60 * 60 * 6)] as const),
  )
  const posters = await Promise.all(withExamples.map(async t => [t.id, await ensurePoster(supabase, t.examplePath!)] as const))
  return NextResponse.json(
    {
      examples: Object.fromEntries(entries.filter(([, u]) => u)),
      posters: Object.fromEntries(posters.filter(([, u]) => u)),
    },
    { headers: { 'Cache-Control': 'private, max-age=1800' } },
  )
}
