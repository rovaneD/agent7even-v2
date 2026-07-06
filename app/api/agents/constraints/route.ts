import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getWorkspaceSessionFromRequest,
  workspaceActorId,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'
import { getTeamPermissions } from '@/lib/teamPermissions'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agentId')
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = workspaceDataUserId(session)

  const { data } = await supabase
    .from('agent_constraints')
    .select('constraints, updated_at')
    .eq('user_id', workspaceId)
    .eq('agent_id', agentId)
    .single()

  return NextResponse.json({
    constraints: data?.constraints ?? null,
    updated_at: data?.updated_at ?? null,
  })
}

export async function POST(req: Request) {
  const { agentId, constraints } = await req.json()
  if (!agentId || !constraints) {
    return NextResponse.json({ error: 'agentId and constraints required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberId = workspaceActorId(session)
  const workspaceId = workspaceDataUserId(session)
  const perms = await getTeamPermissions(memberId)
  if (!perms.isOwner) {
    return NextResponse.json({ error: 'Only account owners can update agent constraints' }, { status: 403 })
  }

  const { error } = await supabase
    .from('agent_constraints')
    .upsert(
      {
        user_id:    workspaceId,
        agent_id:   agentId,
        constraints,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,agent_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
