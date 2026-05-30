import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

async function getAdminProfile(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()
  return data
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminProfile(userId)
  if (!admin || !['admin', 'owner'].includes(admin.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter')
  const sort = searchParams.get('sort') ?? 'last_active_at'
  const order = searchParams.get('order') === 'asc'

  let query = supabase
    .from('profiles')
    .select(`
      id, full_name, email, avatar_url, plan, status,
      last_active_at, engagement_score, foundation_score,
      created_at
    `)
    .eq('role', 'client')
    .order(sort as any, { ascending: order })

  if (filter === 'at_risk') {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    query = query.or(`last_active_at.lt.${fortyEightHoursAgo},engagement_score.lt.30`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ clients: data ?? [] })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminProfile(userId)
  if (!admin || !['admin', 'owner'].includes(admin.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { clientId, action } = await req.json()
  if (!clientId || action !== 'nudge') {
    return NextResponse.json({ error: 'clientId and action=nudge required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const firstName = client.full_name?.split(' ')[0] ?? 'there'

  await supabase.from('notifications').insert({
    user_id: client.id,
    type:    'maya_nudge',
    title:   'Maya has work ready for you',
    body:    `Hey ${firstName} — it's been a few days. Your agents are ready to run and there's work waiting. Want to pick up where we left off?`,
    link:    '/dashboard',
    read:    false,
  })

  await supabase
    .from('profiles')
    .update({ last_nudged_at: new Date().toISOString() })
    .eq('id', client.id)

  return NextResponse.json({ success: true })
}
