import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import SupportClient from './SupportClient'

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const { ticket: initialTicketId } = await searchParams

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, email, full_name')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) redirect('/dashboard')

  const { data: tickets } = await supabase
    .from('support_tickets')
    .select(`
      *,
      support_messages (
        id, sender_role, body, created_at
      )
    `)
    .eq('user_id', profile.id)
    .order('updated_at', { ascending: false })

  return (
    <SupportClient
      profileId={profile.id}
      companyName={profile.company_name ?? ''}
      clientEmail={profile.email ?? ''}
      clientName={profile.full_name ?? ''}
      tickets={tickets ?? []}
      initialTicketId={initialTicketId ?? null}
    />
  )
}
