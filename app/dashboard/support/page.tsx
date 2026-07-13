import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import SupportClient from './SupportClient'
import { resolveLinkedServiceOrder } from '@/lib/support/serviceOrderLink'

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const { ticket: initialTicketId } = await searchParams

  const supabase = createServiceClient()

  const profile = await resolveClerkProfile<{
    id: string
    company_name: string | null
    email: string | null
    full_name: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    plan: string | null
    created_at: string
  }>(supabase, userId, 'id, company_name, email, full_name')

  if (!profile) redirect('/dashboard')

  const [{ data: tickets }, { data: orders }] = await Promise.all([
    supabase
      .from('support_tickets')
      .select(`
        *,
        support_messages (
          id, sender_role, body, created_at
        )
      `)
      .eq('user_id', profile.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('orders')
      .select('id, title')
      .eq('user_id', profile.id),
  ])

  const orderById = new Map((orders ?? []).map(order => [order.id, order]))
  const ticketsWithLinks = (tickets ?? []).map(ticket => {
    const linked = resolveLinkedServiceOrder(ticket, orderById)
    return {
      ...ticket,
      linked_order_id: linked?.orderId ?? null,
      linked_order_title: linked?.title ?? null,
    }
  })

  return (
    <SupportClient
      profileId={profile.id}
      companyName={profile.company_name ?? ''}
      clientEmail={profile.email ?? ''}
      clientName={profile.full_name ?? ''}
      tickets={ticketsWithLinks}
      initialTicketId={initialTicketId ?? null}
    />
  )
}
