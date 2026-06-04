import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getResendClient } from '@/lib/resend'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticketId, status, priority } = await req.json()
  if (!ticketId) return NextResponse.json({ error: 'Ticket ID required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile || !['admin', 'owner'].includes(profile.role)) {
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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'

    if (clientEmail) {
      try {
        const resend = getResendClient()
        if (!resend) throw new Error('Missing RESEND_API_KEY')

        await resend.emails.send({
          from: 'Agent7even Support <hello@agent7even.com>',
          to: clientEmail,
          subject: `Your support ticket has been resolved — ${ticket.subject}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #c8522a;">Ticket resolved</h2>
              <p>Hi ${clientName},</p>
              <p>Your support ticket <strong>${ticket.subject}</strong> has been marked as resolved.</p>
              <p>If you have any further questions, feel free to open a new ticket anytime.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
              <a href="${appUrl}/dashboard/support" style="background: #c8522a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                View your tickets →
              </a>
            </div>
          `,
        })
      } catch (err) {
        console.error('Close email failed:', err)
      }
    }
  }

  return NextResponse.json({ ticket })
}
