import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { loadDashboardSession } from '@/lib/profiles/getDashboardWorkspaceContext'
import ServicesClient from './ServicesClient'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; viralHooks?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const { order: initialOrderId, viralHooks } = await searchParams
  const openViralHooksPrefill = viralHooks === 'prefill'

  const supabase = createServiceClient()
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const { profile, workspace } = await loadDashboardSession(supabase, userId, email)

  if (profile?.id) {
    const teamPerms = await getTeamPermissions(profile.id)
    if (!hasPermission(teamPerms, 'services')) redirect('/dashboard')
  }

  const workspaceProfile = workspace?.workspaceProfile ?? profile
  const dataUserId = workspace?.workspaceId ?? profile?.id

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', dataUserId)
    .order('created_at', { ascending: false })

  const { data: serviceTickets } = dataUserId
    ? await supabase
      .from('support_tickets')
      .select(`
        id,
        body,
        support_messages (
          id, sender_role, body, created_at
        )
      `)
      .eq('user_id', dataUserId)
      .or('subject.ilike.Service request:%,subject.ilike.Self-serve service:%')
      .order('updated_at', { ascending: false })
    : { data: [] }

  const ticketIds = (serviceTickets ?? []).map(ticket => ticket.id)
  const { data: serviceMessages } = ticketIds.length
    ? await supabase
      .from('support_messages')
      .select('id, ticket_id, sender_role, body, created_at')
      .in('ticket_id', ticketIds)
      .order('created_at', { ascending: true })
    : { data: [] }

  const messagesByTicketId = new Map<string, unknown[]>()
  for (const message of serviceMessages ?? []) {
    const ticketId = message.ticket_id
    messagesByTicketId.set(ticketId, [...(messagesByTicketId.get(ticketId) ?? []), message])
  }

  const supportTicketByOrderId = new Map<string, { id: string; body?: string | null; support_messages: unknown[] }>()
  for (const ticket of serviceTickets ?? []) {
    const match = typeof ticket.body === 'string' ? ticket.body.match(/Order ID:\s*([a-f0-9-]+)/i) : null
    const orderId = match?.[1]
    if (orderId && !supportTicketByOrderId.has(orderId)) {
      supportTicketByOrderId.set(orderId, {
        id: ticket.id,
        body: ticket.body,
        support_messages: messagesByTicketId.get(ticket.id) ?? ticket.support_messages ?? [],
      })
    }
  }

  const ordersWithTickets = (orders ?? []).map(order => ({
    ...order,
    support_ticket_id: supportTicketByOrderId.get(order.id)?.id ?? null,
    support_ticket_body: supportTicketByOrderId.get(order.id)?.body ?? null,
    support_messages: supportTicketByOrderId.get(order.id)?.support_messages ?? [],
  }))

  const { data: creditRow } = dataUserId
    ? await supabase
        .from('credit_balances')
        .select('balance')
        .eq('user_id', dataUserId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const displayProfile = workspaceProfile ?? profile

  return (
    <ServicesClient
      profile={displayProfile ? { id: displayProfile.id, plan: displayProfile.plan ?? undefined } : null}
      orders={ordersWithTickets}
      initialOrderId={initialOrderId ?? null}
      openViralHooksPrefill={openViralHooksPrefill}
      creditBalance={creditRow?.balance ?? null}
    />
  )
}
