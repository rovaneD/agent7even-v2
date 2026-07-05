import { NextResponse } from 'next/server'
import { listPendingApprovalTasks } from '@/lib/agents/pendingApprovals'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getWorkspaceSessionFromRequest,
  workspaceActorId,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'

export async function GET() {
  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (workspaceActorId(session) !== workspaceDataUserId(session)) {
    return NextResponse.json({ error: 'Only account owners can review approvals' }, { status: 403 })
  }

  const tasks = await listPendingApprovalTasks(supabase, workspaceDataUserId(session))

  return NextResponse.json({ tasks })
}
