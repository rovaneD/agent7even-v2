import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)
  const { admin } = authResult

  const { id } = await params
  const { body } = await req.json()

  if (!body?.trim()) {
    return NextResponse.json({ error: 'Body required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: note, error } = await supabase
    .from('admin_notes')
    .insert({ user_id: id, admin_id: admin.id, body })
    .select('*, profiles!admin_notes_admin_id_fkey(full_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ note })
}
