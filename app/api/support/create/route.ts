import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { getResendClient } from '@/lib/resend'

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

  const priorityLabel = priority === 'urgent' ? '🚨 URGENT' : priority === 'medium' ? '⚠️ Medium' : 'Low'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'

  const notifyEmail = await getNotifyEmail()

  try {
    const resend = getResendClient()
    if (!resend) throw new Error('Missing RESEND_API_KEY')

    await resend.emails.send({
      from: 'Agent7even <hello@agent7even.com>',
      to: notifyEmail,
      subject: `[${priorityLabel}] New support ticket — ${subject}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #c8522a;">New Support Ticket</h2>
          <p><strong>From:</strong> ${profile.full_name ?? 'Unknown'} (${profile.company_name ?? ''})</p>
          <p><strong>Email:</strong> ${profile.email}</p>
          <p><strong>Priority:</strong> ${priorityLabel}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <p style="white-space: pre-wrap; color: #444;">${body}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <a href="${appUrl}/admin/support/${ticket.id}" style="background: #c8522a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            View &amp; Reply →
          </a>
        </div>
      `,
    })
  } catch (err) {
    console.error('Admin email failed:', err)
  }

  return NextResponse.json({
    ticket: { ...ticket, support_messages: [message] },
  })
}
