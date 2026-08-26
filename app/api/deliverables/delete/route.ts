import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardProfileForClerkUser } from '@/lib/profiles/getDashboardProfile'
import { getWorkspaceAuthContext } from '@/lib/profiles/workspaceSession'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import {
  canAccessWorkspaceDeliverable,
  projectUserIdFromDeliverable,
} from '@/lib/deliverables/deliverableWorkspace'

export async function POST(req: Request) {
  const { deliverableId } = await req.json()
  if (!deliverableId) return NextResponse.json({ error: 'Deliverable ID required' }, { status: 400 })

  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getDashboardProfileForClerkUser(supabase, ctx.clerkUserId, ctx.email)
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const isPlatformAdmin = profile.role === 'admin' || profile.role === 'owner'
  const perms = await getTeamPermissions(ctx.session.memberId)
  if (!isPlatformAdmin && !hasPermission(perms, 'deliverables')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data: deliverable } = await supabase
    .from('deliverables')
    .select('id, file_url, uploaded_by, projects!inner(user_id)')
    .eq('id', deliverableId)
    .single()

  if (!deliverable) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = canAccessWorkspaceDeliverable({
    isPlatformAdmin,
    workspaceId: ctx.session.workspaceId,
    memberId: ctx.session.memberId,
    projectUserId: projectUserIdFromDeliverable(deliverable),
    uploadedBy: deliverable.uploaded_by ?? null,
  })

  if (!allowed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { error: storageError } = deliverable.file_url
    ? await supabase.storage.from('deliverables').remove([deliverable.file_url])
    : { error: null }

  if (storageError) {
    console.error('Storage delete error:', storageError)
  }

  await supabase.from('deliverables').delete().eq('id', deliverableId)

  return NextResponse.json({ success: true })
}
