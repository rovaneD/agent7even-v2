import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)

  const { id } = await params
  const body = await req.json()

  const allowed = ['plan', 'role', 'status'] as const
  const update: Record<string, unknown> = {}

  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  if (body.billing_exempt !== undefined) {
    update.billing_exempt = Boolean(body.billing_exempt)
  }

  update.updated_at = new Date().toISOString()

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', id)
    .select('id, plan, role, status, billing_exempt')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profile: data })
}
