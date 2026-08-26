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
  const { deliverableId, filePath: legacyFilePath } = await req.json()
  if (!deliverableId && !legacyFilePath) return NextResponse.json({ error: 'Deliverable ID required' }, { status: 400 })

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

  const query = supabase
    .from('deliverables')
    .select('id, file_url, uploaded_by, projects!inner(user_id)')

  const { data: deliverable } = await (deliverableId
    ? query.eq('id', deliverableId).single()
    : query.eq('file_url', legacyFilePath).single())

  if (!deliverable?.file_url) {
    return NextResponse.json({ error: 'Deliverable not found' }, { status: 404 })
  }

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

  const { data, error } = await supabase.storage
    .from('deliverables')
    .createSignedUrl(deliverable.file_url, 60)

  if (error || !data?.signedUrl) {
    console.error('Signed URL error:', error)
    return NextResponse.json({ error: 'Failed to generate download link.' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
