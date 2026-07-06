import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'

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
  is_account_owner?: boolean | null
  account_id?: string | null
}

type EnrichedClientRow = ClientRow & {
  is_team_member: boolean
  workspace_owner_id: string | null
  workspace_company: string | null
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

async function enrichTeamMemberClients(
  supabase: ReturnType<typeof createServiceClient>,
  clients: ClientRow[],
): Promise<EnrichedClientRow[]> {
  const ownerIds = [
    ...new Set(
      clients
        .filter(c => c.is_account_owner === false && c.account_id)
        .map(c => c.account_id as string),
    ),
  ]

  const ownerMap = new Map<string, Pick<ClientRow, 'company_name' | 'plan' | 'foundation_score' | 'status'>>()
  if (ownerIds.length > 0) {
    const { data: owners } = await supabase
      .from('profiles')
      .select('id, company_name, plan, foundation_score, status')
      .in('id', ownerIds)

    for (const owner of owners ?? []) {
      ownerMap.set(owner.id as string, {
        company_name: owner.company_name as string | null,
        plan: owner.plan as string | null,
        foundation_score: owner.foundation_score as number | null,
        status: owner.status as string | null,
      })
    }
  }

  return clients.map(client => {
    const isTeamMember = client.is_account_owner === false && !!client.account_id
    if (!isTeamMember) {
      return {
        ...client,
        is_team_member: false,
        workspace_owner_id: null,
        workspace_company: null,
      }
    }

    const owner = ownerMap.get(client.account_id as string)
    return {
      ...client,
      is_team_member: true,
      workspace_owner_id: client.account_id ?? null,
      workspace_company: owner?.company_name ?? null,
      company_name: owner?.company_name ?? client.company_name,
      plan: owner?.plan ?? client.plan,
      foundation_score: owner?.foundation_score ?? client.foundation_score,
      status: owner?.status ?? client.status,
    }
  })
}

export async function GET(req: Request) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)

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
      created_at, is_account_owner, account_id
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
  const { clients: deduped, duplicates } = dedupeClientsByEmail(rows)
  const clients = await enrichTeamMemberClients(supabase, deduped)

  return NextResponse.json({ clients, duplicates })
}

export async function POST(req: Request) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)

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
