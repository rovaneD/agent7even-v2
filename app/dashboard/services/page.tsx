import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import ServicesClient from './ServicesClient'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const { order: initialOrderId } = await searchParams

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_user_id', userId)
    .single()

  if (profile?.id) {
    const teamPerms = await getTeamPermissions(profile.id)
    if (!hasPermission(teamPerms, 'services')) redirect('/dashboard')
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', profile?.id)
    .order('created_at', { ascending: false })

  const { data: serviceTickets } = profile?.id
    ? await supabase
      .from('support_tickets')
      .select(`
        id,
        body,
        support_messages (
          id, sender_role, body, created_at
        )
      `)
      .eq('user_id', profile.id)
      .or('subject.ilike.Service request:%,subject.ilike.Self-serve service:%')
      .order('updated_at', { ascending: false })
    : { data: [] }

  const supportTicketByOrderId = new Map<string, { id: string; support_messages: unknown[] }>()
  for (const ticket of serviceTickets ?? []) {
    const match = typeof ticket.body === 'string' ? ticket.body.match(/Order ID:\s*([a-f0-9-]+)/i) : null
    const orderId = match?.[1]
    if (orderId && !supportTicketByOrderId.has(orderId)) {
      supportTicketByOrderId.set(orderId, {
        id: ticket.id,
        support_messages: ticket.support_messages ?? [],
      })
    }
  }

  const ordersWithTickets = (orders ?? []).map(order => ({
    ...order,
    support_ticket_id: supportTicketByOrderId.get(order.id)?.id ?? null,
    support_messages: supportTicketByOrderId.get(order.id)?.support_messages ?? [],
  }))

  return (
    <ServicesClient
      profile={profile}
      orders={ordersWithTickets}
      initialOrderId={initialOrderId ?? null}
    />
  )
}
