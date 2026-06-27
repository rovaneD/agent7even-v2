import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as publisher from '@/lib/social/publisher'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
])

const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const MAX_ITEMS = 10

export async function POST(req: Request) {
  if (!process.env.ZERNIO_API_KEY) {
    return NextResponse.json(
      { error: 'zernio_not_configured', message: 'Social publishing is not configured on this server.' },
      { status: 503 },
    )
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plan')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile?.plan) {
    return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const contentType = file.type || 'application/octet-stream'
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: 'unsupported_type', message: `File type not supported: ${contentType}` },
      { status: 400 },
    )
  }

  const isVideo = contentType.startsWith('video/')
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024))
    return NextResponse.json(
      { error: 'file_too_large', message: `File exceeds ${limitMb} MB limit` },
      { status: 400 },
    )
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload'

  return publisher.withZernioUsageContext(
    { userId: profile.id as string },
    async () => {
      const presign = await publisher.presignMedia({
        filename: safeName,
        contentType,
        size: file.size,
      })

      if (!presign) {
        return NextResponse.json({ error: 'presign_failed' }, { status: 502 })
      }

      const buffer = await file.arrayBuffer()
      const uploaded = await publisher.uploadToPresignedUrl(presign.uploadUrl, buffer, contentType)
      if (!uploaded) {
        return NextResponse.json({ error: 'upload_failed' }, { status: 502 })
      }

      return NextResponse.json({
        url: presign.publicUrl,
        type: presign.mediaType,
        title: safeName,
        maxItems: MAX_ITEMS,
      })
    },
  )
}
