import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { documentId, content } = await req.json()

  const supabase = createServiceClient()

  const profile = await resolveClerkProfile(supabase, userId, 'id')

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Verify ownership
  const { data: existing } = await supabase
    .from('brand_documents')
    .select('id, version, content, user_id')
    .eq('id', documentId)
    .single()

  if (!existing || existing.user_id !== profile.id) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Archive current version before saving edits
  await supabase.from('brand_document_versions').insert({
    document_id: existing.id,
    content: existing.content,
    version: existing.version,
  })

  const { data: updated, error } = await supabase
    .from('brand_documents')
    .update({
      content,
      version: existing.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .select()
    .single()

  if (error) {
    console.error('Save document error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ document: updated })
}
