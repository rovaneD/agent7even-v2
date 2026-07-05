import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { AGENTS, type AgentId } from '@/lib/agents/registry'
import { createAssignedAgentTask } from '@/lib/team/taskAssignments'
import {
  getWorkspaceAuthContext,
  workspaceActorId,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'
import { getTeamPermissions } from '@/lib/teamPermissions'

export async function POST(req: Request) {
  const body = await req.json()
  const {
    assigneeProfileId,
    agent,
    assignmentNote,
    assignmentDueAt,
    input = {},
  } = body as {
    assigneeProfileId?: string
    agent?: string
    assignmentNote?: string
    assignmentDueAt?: string | null
    input?: Record<string, unknown>
  }

  if (!assigneeProfileId || !agent || !assignmentNote?.trim()) {
    return NextResponse.json(
      { error: 'assigneeProfileId, agent, and assignmentNote are required' },
      { status: 400 },
    )
  }

  if (!AGENTS[agent as AgentId]) {
    return NextResponse.json({ error: 'Invalid agent' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberId = workspaceActorId(ctx.session)
  const workspaceId = workspaceDataUserId(ctx.session)
  const perms = await getTeamPermissions(memberId)

  if (!perms.isOwner) {
    return NextResponse.json({ error: 'Only account owners can assign work' }, { status: 403 })
  }

  try {
    const task = await createAssignedAgentTask({
      supabase,
      workspaceId,
      assignerProfileId: memberId,
      assigneeProfileId,
      agent: agent as AgentId,
      assignmentNote: assignmentNote.trim(),
      assignmentDueAt: assignmentDueAt ?? null,
      input,
    })

    return NextResponse.json({ taskId: task.id, status: task.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Assignment failed'
    const status = message.includes('team member') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
