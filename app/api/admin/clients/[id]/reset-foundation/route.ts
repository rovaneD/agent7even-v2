import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'
import { resolveAdminWorkspaceTargetId } from '@/lib/admin/resolveAdminClientWorkspace'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)

  const { id } = await params
  const supabase = createServiceClient()
  const targetId = await resolveAdminWorkspaceTargetId(supabase, id)
  if (!targetId) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ foundation_complete: false, foundation_score: 0 })
    .eq('id', targetId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
