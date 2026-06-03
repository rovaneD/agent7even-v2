import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { createNotification } from '@/lib/createNotification'
import { formatOrderNumber } from '@/lib/orders/formatOrderNumber'
import { openRouterCompleteWithFallback } from '@/lib/agents/openrouter'
import { displayServiceBrief, VIRAL_HOOKS_FRAMEWORK } from '@/lib/services/viralHooks'

function displayBrief(brief: string) {
  return displayServiceBrief(brief)
}

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
      .select('id, email, full_name, company_name, foundation_answers, business_type, ideal_customer, top_goals, marketing_challenge')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
    const profile = profileRows?.[0]

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const visibleBrief = displayBrief(brief)

    if (service_type === 'viral_hooks') {
      const { data: brandDocs } = await supabase
        .from('brand_documents')
        .select('type, content')
        .eq('user_id', profile.id)
        .in('type', ['voice', 'positioning', 'persona'])

      const brandContext = (brandDocs ?? [])
        .map(doc => `## ${doc.type}\n${doc.content}`)
        .join('\n\n')

      let result: { content: string; inputTokens: number; outputTokens: number; modelUsed: string }

      try {
        result = await openRouterCompleteWithFallback(
          {
            model: 'anthropic/claude-haiku-4-5',
            messages: [{
              role: 'user',
              content: `You are Maya, Agent7even's marketing strategist. Generate a self-serve Viral Hooks output inside the user's Services page.

Business context:
- Company: ${profile.company_name ?? profile.full_name ?? 'Unknown'}
- Business type: ${profile.business_type ?? 'Not provided'}
- Ideal customer: ${profile.ideal_customer ?? 'Not provided'}
- Top goals: ${profile.top_goals ?? 'Not provided'}
- Marketing challenge: ${profile.marketing_challenge ?? 'Not provided'}
- Foundation answers: ${JSON.stringify(profile.foundation_answers ?? {})}

Brand context:
${brandContext || 'No Brand Kit documents found.'}

Customer request:
${visibleBrief}

${VIRAL_HOOKS_FRAMEWORK}

Return a polished self-serve deliverable with:
1. A short "How to use these hooks" note.
2. Five sections matching the hook families.
3. At least 5 finished hooks per family.
4. A format label for each hook.
5. A final "Strongest 5 to test first" section with one-sentence rationale for each.

Do not ask follow-up questions. Make practical assumptions and produce the hooks now.`,
            }],
            max_tokens: 2400,
            temperature: 0.8,
          },
          ['google/gemini-2.5-flash']
        )
      } catch (generationError) {
        console.error('Viral Hooks generation error:', generationError)
        return NextResponse.json(
          { error: 'Viral Hooks generation failed. Try again in a moment.' },
          { status: 502 }
        )
      }

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          user_id: profile.id,
          service_type,
          title,
          brief,
          status: 'delivered',
          priority: 'medium',
          delivered_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error('Viral Hooks order creation error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const orderNumber = formatOrderNumber(order)
      const supportBody = `Order ID: ${order.id}
Order number: ${orderNumber}
Service: ${title}
Client: ${profile.company_name || profile.full_name || profile.email}

Request brief:
${brief}

Generated output:
${result.content}`

      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          user_id: profile.id,
          subject: `Self-serve service: ${title}`,
          body: supportBody,
          priority: 'low',
          status: 'closed',
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      let supportMessages: unknown[] = []

      if (ticketError || !ticket) {
        console.error('Viral Hooks ticket creation error:', ticketError)
      } else {
        const { data: messages, error: messageError } = await supabase
          .from('support_messages')
          .insert([
            {
              ticket_id: ticket.id,
              sender_id: profile.id,
              sender_role: 'client',
              body: visibleBrief,
            },
            {
              ticket_id: ticket.id,
              sender_id: profile.id,
              sender_role: 'admin',
              body: result.content,
            },
          ])
          .select('id, sender_role, body, created_at')

        if (messageError) console.error('Viral Hooks message creation error:', messageError)
        supportMessages = messages?.length
          ? messages
          : [{
            id: `${ticket.id}-generated`,
            sender_role: 'admin',
            body: result.content,
            created_at: new Date().toISOString(),
          }]
      }

      await createNotification({
        userId: profile.id,
        title: 'Your Viral Hooks are ready',
        body: `${orderNumber} is ready to review in Services.`,
        type: 'order_status',
        link: `/dashboard/services?order=${order.id}`,
        sendEmail: false,
      })

      return NextResponse.json({
        success: true,
        order,
        supportTicketId: ticket?.id ?? null,
        supportTicketBody: ticket?.body ?? supportBody,
        supportMessages,
      })
    }

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

    const orderNumber = formatOrderNumber(order)
    const supportBody = `Order ID: ${order.id}
Order number: ${orderNumber}
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

    let supportMessage = null

    if (ticketError || !ticket) {
      console.error('Support ticket creation error:', ticketError)
    } else {
      const { data: message, error: messageError } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          sender_id: profile.id,
          sender_role: 'client',
          body: supportBody,
        })
        .select('id, sender_role, body, created_at')
        .single()

      if (messageError) console.error('Support message creation error:', messageError)
      supportMessage = message ?? null
    }

    // Notify client — request confirmed
    await createNotification({
      userId: profile.id,
      title: 'Service request submitted',
      body: `Your ${title} request ${orderNumber} has been submitted. We'll be in touch within 1 business day.`,
      type: 'order_status',
      link: `/dashboard/services?order=${order.id}`,
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
      body: `${profile.company_name ?? profile.full_name ?? profile.email} submitted ${orderNumber} for ${title}. Open Orders to view the brief and follow up.`,
      type: 'order_status',
      link: `/admin/orders?order=${order.id}`,
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
          subject: `New service request ${orderNumber}: ${title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
              <div style="background: #0d0d0d; padding: 24px; border-radius: 12px 12px 0 0;">
                <h2 style="color: #f0ece6; margin: 0; font-size: 18px;">New service request</h2>
              </div>
              <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #eee;">
                <p style="margin: 0 0 8px; font-size: 13px; color: #555;"><strong>Service:</strong> ${title}</p>
                <p style="margin: 0 0 8px; font-size: 13px; color: #555;"><strong>Order:</strong> ${orderNumber}</p>
                <p style="margin: 0 0 8px; font-size: 13px; color: #555;"><strong>Client:</strong> ${profile.company_name || profile.full_name || profile.email}</p>
                <p style="margin: 0 0 16px; font-size: 13px; color: #555;"><strong>Email:</strong> ${profile.email}</p>
                <div style="background: white; border: 1px solid #eee; border-radius: 8px; padding: 16px; font-size: 13px; color: #333; line-height: 1.6;">
                  <strong>Brief:</strong><br/>${visibleBrief}
                </div>
                <p style="margin: 16px 0 0; font-size: 13px;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'}/admin/orders?order=${order.id}" style="color: #c8522a; font-weight: 600;">Open admin order →</a>
                </p>
              </div>
            </div>
          `,
        })
      } catch (emailErr) {
        console.error('Admin notification email failed:', emailErr)
      }
    }

    return NextResponse.json({
      success: true,
      order,
      supportTicketId: ticket?.id ?? null,
      supportMessages: supportMessage ? [supportMessage] : [],
    })
  } catch (err) {
    console.error('Create order error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
