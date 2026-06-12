import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

type ClientRow = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  company_name: string | null
  website_url: string | null
  instagram_handle: string | null
  plan: string | null
  status: string | null
  role: string | null
  stripe_customer_id: string | null
  last_active_at: string | null
  engagement_score: number | null
  engagement_updated_at: string | null
  foundation_score: number | null
  created_at: string
}

function profilePriority(p: ClientRow): number {
  let score = 0
  if (p.status === 'active') score += 40
  if (p.plan) score += 30
  if (p.stripe_customer_id) score += 20
  if (p.foundation_score && p.foundation_score > 0) score += 5
  score += new Date(p.created_at).getTime() / 1e15
  return score
}

function dedupeClientsByEmail(clients: ClientRow[]): {
  clients: ClientRow[]
  duplicates: { email: string; count: number }[]
} {
  const byEmail = new Map<string, ClientRow[]>()
  const noEmail: ClientRow[] = []

  for (const client of clients) {
    const email = client.email?.trim().toLowerCase()
    if (!email) {
      noEmail.push(client)
      continue
    }
    const group = byEmail.get(email) ?? []
    group.push(client)
    byEmail.set(email, group)
  }

  const duplicates: { email: string; count: number }[] = []
  const picked: ClientRow[] = [...noEmail]

  for (const [email, group] of byEmail) {
    if (group.length > 1) {
      duplicates.push({ email, count: group.length })
      group.sort((a, b) => profilePriority(b) - profilePriority(a))
    }
    picked.push(group[0])
  }

  return { clients: picked, duplicates }
}

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
  const sort = searchParams.get('sort') ?? 'last_active_at'
  const order = searchParams.get('order') === 'asc'
  const search = searchParams.get('search')
  const planFilter = searchParams.get('plan')
  const statusFilter = searchParams.get('status')

  let query = supabase
    .from('profiles')
    .select(`
      id, full_name, email, avatar_url,
      company_name, website_url, instagram_handle,
      plan, status, role, stripe_customer_id,
      last_active_at, engagement_score, engagement_updated_at, foundation_score,
      created_at
    `)
    .eq('role', 'client')
    .neq('status', 'churned')
    .order(sort as any, { ascending: order })

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  if (planFilter && planFilter !== 'all') {
    query = query.eq('plan', planFilter)
  }

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as ClientRow[]
  const { clients, duplicates } = dedupeClientsByEmail(rows)

  return NextResponse.json({ clients, duplicates })
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

  return NextResponse.json({ success: true })
}
