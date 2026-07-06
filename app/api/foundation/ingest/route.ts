import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { extractText, interpretExtraction } from '@/lib/foundation/extract'
import { resolveFoundationWorkspaceForClerkUser } from '@/lib/foundation/resolveFoundationWorkspace'

const BUCKET = 'foundation-knowledge'

async function ensureBucket(supabase: ReturnType<typeof createServiceClient>) {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
  })
  if (error && !/already exists/i.test(error.message)) {
    console.error('[ingest] bucket create error:', error.message)
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { type, content, filename } = body as {
      type?: string
      content?: string
      filename?: string
    }

    if (!type || !content) {
      return NextResponse.json({ error: 'type and content required' }, { status: 400 })
    }

    const validTypes = ['pdf', 'docx', 'image', 'url', 'text']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    const supabase = createServiceClient()
    const session = await resolveFoundationWorkspaceForClerkUser(supabase, userId)
    if (!session) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    const workspaceId = session.workspaceId

    // Extract raw text
    const rawText = await extractText(type, content, filename)
    if (!rawText.trim()) {
      console.error('[foundation-ingest-diag] ingest: extractText returned empty', {
        type,
        filename: filename ?? null,
        contentLen: content.length,
        exaKeySet: Boolean(process.env.EXA_API_KEY),
        anthropicKeySet: Boolean(process.env.ANTHROPIC_API_KEY),
      })
    }

    // Interpret into Foundation fields
    const sourceName = type === 'url' ? content : (filename ?? `${type} upload`)
    const extractionResult = await interpretExtraction(rawText, sourceName)

    // Store the knowledge item (no file binary stored — only extracted text)
    let storagePath: string | null = null
    if (type !== 'url' && type !== 'text' && content.length > 0) {
      await ensureBucket(supabase)
      const ext = filename ? filename.split('.').pop() : type
      const path = `${workspaceId}/${crypto.randomUUID()}.${ext}`
      const buf = Buffer.from(content, 'base64')
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, buf, { contentType: mimeTypeFor(type, filename), upsert: false })
      if (uploadError) {
        console.error('[foundation-ingest-diag] ingest: storage upload failed', {
          type,
          path,
          message: uploadError.message,
        })
      } else {
        storagePath = path
      }
    }

    const { data: knowledgeRow } = await supabase
      .from('foundation_knowledge')
      .insert({
        profile_id:        workspaceId,
        source_type:       type,
        source_name:       sourceName,
        raw_content:       rawText.slice(0, 50000),
        extraction_result: extractionResult,
        storage_path:      storagePath,
      })
      .select('id')
      .single()

    // Bump count on profile (best-effort)
    await supabase
      .from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', workspaceId)

    return NextResponse.json({
      id: knowledgeRow?.id ?? null,
      extractionResult,
    })
  } catch (e) {
    console.error('[ingest] error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function mimeTypeFor(type: string, filename?: string): string {
  if (type === 'pdf') return 'application/pdf'
  if (type === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (type === 'image') {
    if (filename?.endsWith('.png')) return 'image/png'
    if (filename?.endsWith('.webp')) return 'image/webp'
    return 'image/jpeg'
  }
  return 'application/octet-stream'
}
