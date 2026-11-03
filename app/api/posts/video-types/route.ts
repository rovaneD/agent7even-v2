import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { createPostAssetSignedUrl, downloadPostAsset } from '@/lib/postAssets'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { VIDEO_TYPES } from '@/lib/agents/contentPosting/videoTypes'
import { posterFrame, previewClip } from '@/lib/agents/videoGeneration/assemble'

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

/** Make the example's small looping preview once (stored next to the clip), for the playing tiles. */
async function ensurePreview(supabase: ReturnType<typeof createServiceClient>, videoPath: string): Promise<string | null> {
  const previewPath = videoPath.replace(/\.mp4$/, '') + '.preview.mp4'
  const existing = await createPostAssetSignedUrl(previewPath, 60 * 60 * 6)
  if (existing) {
    const head = await fetch(existing, { method: 'HEAD' }).catch(() => null)
    if (head?.ok) return existing
  }
  const video = await downloadPostAsset(videoPath)
  const small = video ? await previewClip(video) : null
  if (!small) return null
  const { error } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(previewPath, small, { contentType: 'video/mp4', upsert: true })
  return error ? null : createPostAssetSignedUrl(previewPath, 60 * 60 * 6)
}

/**
 * Example clips for the video gallery: { examples: { [typeId]: url }, posters: { [typeId]: url } }.
 * Tiles loop a small preview (owner 2026-11-02); the create panel plays the full clip (Supabase egress,
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
  const [posters, previews] = await Promise.all([
    Promise.all(withExamples.map(async t => [t.id, await ensurePoster(supabase, t.examplePath!)] as const)),
    Promise.all(withExamples.map(async t => [t.id, await ensurePreview(supabase, t.examplePath!)] as const)),
  ])
  return NextResponse.json(
    {
      examples: Object.fromEntries(entries.filter(([, u]) => u)),
      posters: Object.fromEntries(posters.filter(([, u]) => u)),
      previews: Object.fromEntries(previews.filter(([, u]) => u)),
    },
    // Short cache: a new example (e.g. Product ad, 2026-11-02) showed as "in production" for 30 min.
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  )
}
