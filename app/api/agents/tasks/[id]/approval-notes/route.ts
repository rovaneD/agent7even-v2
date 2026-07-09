import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getWorkspaceAuthContext,
  workspaceActorId,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'
import {
  assertPendingApprovalTask,
  createApprovalComment,
  listApprovalNotes,
} from '@/lib/agents/approvalNotes'
import { assertWorkspaceTeamParticipant } from '@/lib/team/taskNotes'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberId = workspaceActorId(ctx.session)
  const workspaceId = workspaceDataUserId(ctx.session)

  const access = await assertWorkspaceTeamParticipant(supabase, workspaceId, memberId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: 403 })

  const task = await assertPendingApprovalTask(supabase, workspaceId, taskId)
  if (!task) return NextResponse.json({ error: 'Approval item not found' }, { status: 404 })

  try {
    const notes = await listApprovalNotes(supabase, taskId)
    return NextResponse.json({ notes })
  } catch (err) {
    console.error('[approval notes GET]', err)
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params
  const body = await req.json().catch(() => ({})) as { body?: string }

  if (!body.body?.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberId = workspaceActorId(ctx.session)
  const workspaceId = workspaceDataUserId(ctx.session)

  try {
    const note = await createApprovalComment({
      supabase,
      workspaceId,
      authorProfileId: memberId,
      taskId,
      body: body.body,
    })
    return NextResponse.json({ note })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save note'
    const status = message.includes('Not a member') ? 403
      : message.includes('not found') ? 404
      : message.includes('empty') ? 400
      : 500
    return NextResponse.json({ error: message }, { status })
  }
}
