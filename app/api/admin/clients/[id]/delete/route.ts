import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { deleteClientAccount } from '@/lib/admin/deleteClientAccount'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)

  const { id } = await params
  const supabase = createServiceClient()
  const result = await deleteClientAccount(supabase, id, authResult.admin.profileId)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true })
}
