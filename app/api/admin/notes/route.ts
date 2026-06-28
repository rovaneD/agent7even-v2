import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'

export async function POST(req: NextRequest) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)
  const { admin } = authResult

  const supabase = createServiceClient()

  const { client_id, body } = await req.json()
  if (!client_id || !body) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: note, error } = await supabase
    .from('admin_notes')
    .insert({ user_id: client_id, admin_id: admin.id, body })
    .select('*, profiles!admin_notes_admin_id_fkey(full_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ note })
}
