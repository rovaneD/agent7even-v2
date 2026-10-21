import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getWorkspaceAuthContext, workspaceDataUserId } from '@/lib/profiles/workspaceSession'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'

const INTERNAL_EMAILS = new Set(['rovane@dursodesign.com', 'melissa@agent7even.com', 'rovdurs@gmail.com'])
const ALLOWED = new Set(['audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'image/png', 'image/jpeg'])

/**
 * Internal only: store a small reference file (a voice recording, a photo) for bake-off tests and
 * return a 24h signed URL that providers can fetch. Body: { name, contentType, base64 } (≤ 3 MB).
 */
export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx?.email || !INTERNAL_EMAILS.has(ctx.email.toLowerCase())) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const profileId = workspaceDataUserId(ctx.session)

  const body = (await req.json().catch(() => ({}))) as { name?: string; contentType?: string; base64?: string }
  if (!body.base64 || !body.contentType || !ALLOWED.has(body.contentType)) {
    return NextResponse.json({ error: 'base64_and_allowed_contentType_required' }, { status: 400 })
  }
  const bytes = Buffer.from(body.base64, 'base64')
  if (bytes.length === 0 || bytes.length > 3 * 1024 * 1024) return NextResponse.json({ error: 'size' }, { status: 400 })

  const safe = (body.name ?? 'file').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 60) || 'file'
  const path = `${profileId}/internal-upload-${Date.now()}-${safe}`
  const { error } = await supabase.storage.from(POST_ASSETS_BUCKET).upload(path, bytes, { contentType: body.contentType, upsert: true })
  if (error) return NextResponse.json({ error: 'upload_failed', message: error.message }, { status: 500 })
  return NextResponse.json({ path, url: await createPostAssetSignedUrl(path, 60 * 60 * 24), bytes: bytes.length })
}
