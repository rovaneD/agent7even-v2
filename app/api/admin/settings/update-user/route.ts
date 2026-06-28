import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'

export async function POST(req: Request) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)

  const supabase = createServiceClient()

  const { userId: targetId, role, status, plan } = await req.json()
  if (!targetId) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (role !== undefined) updates.role = role
  if (status !== undefined) updates.status = status
  if (plan !== undefined) updates.plan = plan

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', targetId)

  if (error) {
    console.error('User update error:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
