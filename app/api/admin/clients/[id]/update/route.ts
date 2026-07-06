import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'
import { resolveAdminWorkspaceTargetId } from '@/lib/admin/resolveAdminClientWorkspace'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)

  const { id } = await params
  const body = await req.json()

  const workspaceScoped = ['plan', 'status'] as const
  const profileScoped = ['role'] as const
  const update: Record<string, unknown> = {}

  for (const key of workspaceScoped) {
    if (body[key] !== undefined) update[key] = body[key]
  }
  for (const key of profileScoped) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  if (body.billing_exempt !== undefined) {
    update.billing_exempt = Boolean(body.billing_exempt)
  }

  update.updated_at = new Date().toISOString()

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const hasWorkspaceUpdate =
    workspaceScoped.some(key => body[key] !== undefined) ||
    body.billing_exempt !== undefined
  const hasProfileUpdate = profileScoped.some(key => body[key] !== undefined)

  if (hasWorkspaceUpdate && hasProfileUpdate) {
    return NextResponse.json({ error: 'Workspace and profile fields must be updated separately' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const targetId = hasWorkspaceUpdate
    ? await resolveAdminWorkspaceTargetId(supabase, id)
    : id

  if (!targetId) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', targetId)
    .select('id, plan, role, status, billing_exempt')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ profile: data })
}
