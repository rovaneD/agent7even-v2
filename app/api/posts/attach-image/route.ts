import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  createPostAssetSignedUrl,
  mimeFromFilename,
  readPostMediaRef,
  uploadPostAsset,
} from '@/lib/postAssets'
import { validateImageContextUpload } from '@/lib/posts/imageContextCapabilities'

type AttachBody = {
  content?: string
  filename?: string
  mime?: string
  taskId?: string
  outputId?: string
}

function parseBase64(content: string): Buffer {
  const raw = content.includes(',') ? content.split(',')[1]! : content
  return Buffer.from(raw, 'base64')
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plan')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (!profile.plan) {
    return NextResponse.json({ error: 'active_plan_required' }, { status: 403 })
  }

  let body: AttachBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { content, filename = 'upload.jpg', mime, taskId, outputId } = body
  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content required (base64)' }, { status: 400 })
  }

  const resolvedMime = mime ?? mimeFromFilename(filename)

  let bytes: Buffer
  try {
    bytes = parseBase64(content)
  } catch {
    return NextResponse.json({ error: 'invalid_base64' }, { status: 400 })
  }

  const uploadCheck = validateImageContextUpload(resolvedMime, bytes.byteLength)
  if (!uploadCheck.ok) {
    return NextResponse.json(
      { error: uploadCheck.code, message: uploadCheck.message },
      { status: 400 },
    )
  }

  try {
    const { storagePath } = await uploadPostAsset({
      profileId: profile.id as string,
      filename,
      mime: resolvedMime,
      bytes,
    })

    const mediaFields = {
      media_storage_path: storagePath,
      media_mime: resolvedMime,
      image_caption_mode: true,
    }

    if (outputId) {
      const { data: existing } = await supabase
        .from('agent_outputs')
        .select('id, content')
        .eq('id', outputId)
        .eq('user_id', profile.id)
        .single()

      if (!existing) return NextResponse.json({ error: 'output_not_found' }, { status: 404 })

      const prev = (existing.content ?? {}) as Record<string, unknown>
      const { error: updateErr } = await supabase
        .from('agent_outputs')
        .update({ content: { ...prev, ...mediaFields } })
        .eq('id', outputId)
        .eq('user_id', profile.id)

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    if (taskId) {
      const { data: task } = await supabase
        .from('agent_tasks')
        .select('id, input')
        .eq('id', taskId)
        .eq('user_id', profile.id)
        .single()

      if (!task) return NextResponse.json({ error: 'task_not_found' }, { status: 404 })

      const prevInput = (task.input ?? {}) as Record<string, unknown>
      const { error: taskErr } = await supabase
        .from('agent_tasks')
        .update({ input: { ...prevInput, ...mediaFields } })
        .eq('id', taskId)
        .eq('user_id', profile.id)

      if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 })
    }

    const previewUrl = await createPostAssetSignedUrl(storagePath)
    if (!previewUrl) {
      return NextResponse.json({ error: 'signed_url_failed' }, { status: 502 })
    }

    return NextResponse.json({
      storagePath,
      mime: resolvedMime,
      previewUrl,
      ...readPostMediaRef(mediaFields),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'upload_failed'
    if (msg === 'unsupported_type') {
      return NextResponse.json({ error: 'unsupported_type' }, { status: 400 })
    }
    if (msg === 'file_too_large') {
      return NextResponse.json({ error: 'file_too_large', message: 'Image must be under 20 MB.' }, { status: 400 })
    }
    console.error('[attach-image]', err)
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 })
  }
}
