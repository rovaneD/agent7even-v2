import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agentId')
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data } = await supabase
    .from('agent_constraints')
    .select('constraints, updated_at')
    .eq('user_id', profile.id)
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { error } = await supabase
    .from('agent_constraints')
    .upsert(
      {
        user_id:    profile.id,
        agent_id:   agentId,
        constraints,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,agent_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
