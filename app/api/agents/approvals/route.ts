import { NextResponse } from 'next/server'
import { listPendingApprovalTasks } from '@/lib/agents/pendingApprovals'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getWorkspaceSessionFromRequest,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'

export async function GET() {
  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tasks = await listPendingApprovalTasks(supabase, workspaceDataUserId(session))

  return NextResponse.json({ tasks })
}
