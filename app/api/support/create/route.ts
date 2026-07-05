import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subject, body, priority } = await req.json()
  if (!subject || !body) return NextResponse.json({ error: 'Subject and body required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, company_name')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: ticket, error: ticketError } = await supabase
    .from('support_tickets')
    .insert({
      user_id: profile.id,
      subject,
      body,
      priority: priority ?? 'low',
      status: 'open',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (ticketError || !ticket) {
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }

  const { data: message } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: ticket.id,
      sender_id: profile.id,
      sender_role: 'client',
      body,
    })
    .select()
    .single()

  const priorityLabel = priority === 'urgent' ? 'URGENT' : priority === 'medium' ? 'Medium' : 'Low'
  const notifyEmail = await getNotifyEmail()

  try {
    await sendTransactionalEmail({
      to: notifyEmail,
      subject: `[${priorityLabel}] New support ticket — ${subject}`,
      title: 'New support ticket',
      body: `From: ${profile.full_name ?? 'Unknown'} (${profile.company_name ?? ''})\nEmail: ${profile.email}\nPriority: ${priorityLabel}\nSubject: ${subject}\n\n${body}`,
      link: `/admin/support/${ticket.id}`,
      ctaLabel: 'View and reply →',
    })
  } catch (err) {
    console.error('Admin email failed:', err)
  }

  return NextResponse.json({
    ticket: { ...ticket, support_messages: [message] },
  })
}
