import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { createNotification } from '@/lib/createNotification'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticketId, body, role } = await req.json()
  if (!ticketId || !body) return NextResponse.json({ error: 'Ticket ID and body required' }, { status: 400 })

  // role param is informational — actual role is determined server-side from profile
  void role

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, company_name, role')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('*, profiles!support_tickets_user_id_fkey(email, full_name, company_name)')
    .eq('id', ticketId)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  if (ticket.status === 'closed') return NextResponse.json({ error: 'Ticket is closed' }, { status: 400 })

  const isAdmin = profile.role === 'admin' || profile.role === 'owner'
  if (!isAdmin && ticket.user_id !== profile.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const serviceOrderId = typeof ticket.body === 'string'
    ? ticket.body.match(/Order ID:\s*([a-f0-9-]+)/i)?.[1] ?? null
    : null
  const isServiceOrder = Boolean(ticket.subject?.startsWith('Service request:') && serviceOrderId)
  const serviceTitle = isServiceOrder ? ticket.subject.replace(/^Service request:\s*/, '') : ticket.subject
  const clientName = profile.company_name ?? profile.full_name ?? profile.email ?? 'Client'

  const { data: message, error: msgError } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: ticketId,
      sender_id: profile.id,
      sender_role: isAdmin ? 'admin' : 'client',
      body,
    })
    .select()
    .single()

  if (msgError) return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })

  await supabase
    .from('support_tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', ticketId)

  // In-app notification for the other party
  if (isAdmin) {
    // Notify the client
    await createNotification({
      userId: ticket.user_id,
      title: isServiceOrder ? 'New reply on your service order' : 'New reply on your support ticket',
      body: isServiceOrder ? `Agent7even replied to your ${serviceTitle} order.` : `Agent7even replied to: ${ticket.subject}`,
      type: isServiceOrder ? 'order_status' : 'support_reply',
      link: isServiceOrder ? `/dashboard/services?order=${serviceOrderId}` : '/dashboard/support',
      sendEmail: false, // email handled below
    })
  } else {
    // Notify admin
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'owner'])

    await Promise.all((adminProfiles ?? []).map(adminProfile => createNotification({
      userId: adminProfile.id,
      title: isServiceOrder ? 'Client replied on service order' : 'New reply on support ticket',
      body: isServiceOrder ? `${clientName} replied to the ${serviceTitle} order.` : `${clientName} replied to: ${ticket.subject}`,
      type: isServiceOrder ? 'order_status' : 'support_reply',
      link: isServiceOrder ? `/admin/orders?order=${serviceOrderId}` : `/admin/support/${ticketId}`,
      sendEmail: false, // email handled below
    })))
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'

  if (isAdmin) {
    const clientEmail = (ticket.profiles as { email: string })?.email
    const ticketClientName = (ticket.profiles as { full_name: string })?.full_name ?? 'there'
    if (clientEmail) {
      try {
        await resend.emails.send({
          from: 'Agent7even Support <hello@agent7even.com>',
          to: clientEmail,
          subject: `Re: ${ticket.subject}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #c8522a;">${isServiceOrder ? 'New reply on your service order' : 'New reply on your support ticket'}</h2>
              <p>Hi ${ticketClientName},</p>
              <p>The Agent7even team has replied to your ${isServiceOrder ? 'service order' : 'ticket'}: <strong>${serviceTitle}</strong></p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
              <p style="white-space: pre-wrap; color: #444;">${body}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
              <a href="${appUrl}${isServiceOrder ? `/dashboard/services?order=${serviceOrderId}` : '/dashboard/support'}" style="background: #c8522a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                View conversation →
              </a>
            </div>
          `,
        })
      } catch (err) {
        console.error('Client reply email failed:', err)
      }
    }
  } else {
    const notifyEmail = await getNotifyEmail()
    try {
      await resend.emails.send({
        from: 'Agent7even <hello@agent7even.com>',
        to: notifyEmail,
        subject: `Re: ${ticket.subject} — ${profile.company_name ?? profile.full_name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #c8522a;">${isServiceOrder ? 'Client replied to service order' : 'Client replied to support ticket'}</h2>
            <p><strong>From:</strong> ${profile.full_name} (${profile.company_name ?? ''})</p>
            <p><strong>${isServiceOrder ? 'Order' : 'Ticket'}:</strong> ${serviceTitle}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
            <p style="white-space: pre-wrap; color: #444;">${body}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
            <a href="${appUrl}${isServiceOrder ? `/admin/orders?order=${serviceOrderId}` : `/admin/support/${ticketId}`}" style="background: #c8522a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              View &amp; Reply →
            </a>
          </div>
        `,
      })
    } catch (err) {
      console.error('Admin reply email failed:', err)
    }
  }

  return NextResponse.json({ message })
}
