import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { createNotification } from '@/lib/createNotification'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { service_type, title, brief } = await req.json()

    if (!service_type || !title || !brief) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Get profile id
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, email, full_name, company_name')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
    const profile = profileRows?.[0]

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // Create order
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        user_id: profile.id,
        service_type,
        title,
        brief,
        status: 'submitted',
        priority: 'medium',
      })
      .select()
      .single()

    if (error) {
      console.error('Order creation error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const supportBody = `Order ID: ${order.id}
Service: ${title}
Client: ${profile.company_name || profile.full_name || profile.email}

Request brief:
${brief}`

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        user_id: profile.id,
        subject: `Service request: ${title}`,
        body: supportBody,
        priority: 'medium',
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (ticketError || !ticket) {
      console.error('Support ticket creation error:', ticketError)
    } else {
      const { error: messageError } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          sender_id: profile.id,
          sender_role: 'client',
          body: supportBody,
        })

      if (messageError) console.error('Support message creation error:', messageError)
    }

    // Notify client — request confirmed
    await createNotification({
      userId: profile.id,
      title: 'Service request submitted',
      body: `Your ${title} request has been submitted. We'll be in touch within 1 business day.`,
      type: 'order_status',
      link: '/dashboard/services',
      sendEmail: false,
    })

    // Notify every admin/owner in-app so the current admin account sees the request.
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'owner'])

    await Promise.all((adminProfiles ?? []).map(adminProfile => createNotification({
      userId: adminProfile.id,
      title: 'New service request',
      body: `${profile.company_name ?? profile.full_name ?? profile.email} submitted a new ${title} request. Open Orders to view the brief and follow up.`,
      type: 'order_status',
      link: '/admin/orders',
      sendEmail: false,
    })))

    // Notify admin via email
    const notifyEmail = await getNotifyEmail()
    if (notifyEmail) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'Agent7even App <hello@agent7even.com>',
          to: notifyEmail,
          subject: `New service request: ${title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
              <div style="background: #0d0d0d; padding: 24px; border-radius: 12px 12px 0 0;">
                <h2 style="color: #f0ece6; margin: 0; font-size: 18px;">New service request</h2>
              </div>
              <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #eee;">
                <p style="margin: 0 0 8px; font-size: 13px; color: #555;"><strong>Service:</strong> ${title}</p>
                <p style="margin: 0 0 8px; font-size: 13px; color: #555;"><strong>Client:</strong> ${profile.company_name || profile.full_name || profile.email}</p>
                <p style="margin: 0 0 16px; font-size: 13px; color: #555;"><strong>Email:</strong> ${profile.email}</p>
                <div style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 16px; font-size: 13px; color: #333; line-height: 1.6;">
                  <strong>Brief:</strong><br/>${brief}
                </div>
                <p style="margin: 16px 0 0; font-size: 13px;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'}/admin/orders" style="color: #c8522a; font-weight: 600;">Open admin orders →</a>
                </p>
              </div>
            </div>
          `,
        })
      } catch (emailErr) {
        console.error('Admin notification email failed:', emailErr)
      }
    }

    return NextResponse.json({ success: true, order, supportTicketId: ticket?.id ?? null })
  } catch (err) {
    console.error('Create order error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
