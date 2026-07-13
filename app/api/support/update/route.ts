import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticketId, status, priority } = await req.json()
  if (!ticketId) return NextResponse.json({ error: 'Ticket ID required' }, { status: 400 })

  const supabase = createServiceClient()

  const profile = await resolveClerkProfile(supabase, userId, 'id, role')

  if (!profile || !['admin', 'owner'].includes(profile.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status) updates.status = status
  if (priority) updates.priority = priority

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .update(updates)
    .eq('id', ticketId)
    .select('*, profiles!support_tickets_user_id_fkey(email, full_name)')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })

  if (status === 'closed') {
    const clientEmail = (ticket.profiles as { email: string })?.email
    const clientName = (ticket.profiles as { full_name: string })?.full_name ?? 'there'

    if (clientEmail) {
      try {
        await sendTransactionalEmail({
          to: clientEmail,
          subject: `Your support ticket has been resolved — ${ticket.subject}`,
          title: 'Ticket resolved',
          body: `Hi ${clientName},\n\nYour support ticket "${ticket.subject}" has been marked as resolved.\n\nIf you have any further questions, feel free to open a new ticket anytime.`,
          link: '/dashboard/support',
          ctaLabel: 'View your tickets →',
        })
      } catch (err) {
        console.error('Close email failed:', err)
      }
    }
  }

  return NextResponse.json({ ticket })
}
