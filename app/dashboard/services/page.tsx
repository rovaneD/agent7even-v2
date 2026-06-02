import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import ServicesClient from './ServicesClient'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'

export default async function ServicesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

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
      .select('id, body')
      .eq('user_id', profile.id)
      .ilike('subject', 'Service request:%')
      .order('updated_at', { ascending: false })
    : { data: [] }

  const supportTicketByOrderId = new Map<string, string>()
  for (const ticket of serviceTickets ?? []) {
    const match = typeof ticket.body === 'string' ? ticket.body.match(/Order ID:\s*([a-f0-9-]+)/i) : null
    const orderId = match?.[1]
    if (orderId && !supportTicketByOrderId.has(orderId)) {
      supportTicketByOrderId.set(orderId, ticket.id)
    }
  }

  const ordersWithTickets = (orders ?? []).map(order => ({
    ...order,
    support_ticket_id: supportTicketByOrderId.get(order.id) ?? null,
  }))

  return (
    <ServicesClient
      profile={profile}
      orders={ordersWithTickets}
    />
  )
}
