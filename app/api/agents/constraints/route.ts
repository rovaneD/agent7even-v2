import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardProfileForClerkUser } from '@/lib/profiles/getDashboardProfile'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agentId')
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

  const supabase = createServiceClient()

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const profile = await getDashboardProfileForClerkUser(supabase, userId, email)

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  const workspaceId = await resolveWorkspaceProfileId(supabase, profile.id)

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
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { agentId, constraints } = await req.json()
  if (!agentId || !constraints) {
    return NextResponse.json({ error: 'agentId and constraints required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const profile = await getDashboardProfileForClerkUser(supabase, userId, email)

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  const workspaceId = await resolveWorkspaceProfileId(supabase, profile.id)

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
