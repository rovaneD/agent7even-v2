import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getNotifyEmail } from '@/lib/getNotifyEmail'
import { createNotification } from '@/lib/createNotification'
import { formatOrderNumber } from '@/lib/orders/formatOrderNumber'
import { openRouterCompleteWithFallback } from '@/lib/agents/openrouter'
import { displayServiceBrief, VIRAL_HOOKS_FRAMEWORK, VIRAL_HOOKS_OUTPUT_MARKER } from '@/lib/services/viralHooks'
import { saveViralHooksDeliverable } from '@/lib/services/saveViralHooksDeliverable'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'
import { getServiceRequestLimit, hasPlatformAccess } from '@/lib/plans'

function displayBrief(brief: string) {
  return displayServiceBrief(brief)
}

function errorMessage(error: unknown) {
  if (!error) return 'Unknown error'
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return String(error)
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
      .select('id, email, full_name, company_name, plan, status, billing_exempt, foundation_answers, business_type, ideal_customer, top_goals, marketing_challenge')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
    const profile = profileRows?.[0]

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    if (!hasPlatformAccess(profile.plan, profile.status, profile.billing_exempt ?? false)) {
      return NextResponse.json(
        { error: 'An active subscription is required to submit service requests.', code: 'NO_ACTIVE_PLAN' },
        { status: 403 },
      )
    }

    // Human-delivered requests are limited per plan (viral_hooks is self-serve
    // and exempt). "Active" mirrors the Services page: anything not closed.
    if (service_type !== 'viral_hooks') {
      const limit = getServiceRequestLimit(profile.plan)
      if (limit != null) {
        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .neq('service_type', 'viral_hooks')
          .not('status', 'in', '("approved","cancelled","completed")')
        if ((count ?? 0) >= limit) {
          return NextResponse.json(
            {
              error: `Your plan includes ${limit} active service request${limit === 1 ? '' : 's'} at a time. Close an open request or upgrade to submit another.`,
              code: 'SERVICE_LIMIT',
            },
            { status: 403 },
          )
        }
      }
    }

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

      if (!result.content?.trim()) {
        return NextResponse.json(
          { error: 'Viral Hooks generation returned no content. Please try again.' },
          { status: 502 }
        )
      }

      const storedBrief = `${visibleBrief}

${VIRAL_HOOKS_OUTPUT_MARKER}
${result.content.trim()}

${VIRAL_HOOKS_FRAMEWORK}`

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          user_id: profile.id,
          service_type,
          title,
          brief: storedBrief,
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
${visibleBrief}

Generated output:
${result.content.trim()}`

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
        await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id)
        return NextResponse.json(
          { error: 'Generated hooks could not be saved. Please try again.' },
          { status: 500 }
        )
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
              body: result.content.trim(),
            },
          ])
          .select('id, sender_role, body, created_at')

        if (messageError) console.error('Viral Hooks message creation error:', messageError)
        supportMessages = messages?.length
          ? messages
          : [{
            id: `${ticket.id}-generated`,
            sender_role: 'admin',
            body: result.content.trim(),
            created_at: new Date().toISOString(),
          }]
      }

      let deliverable = null
      let deliverableWarning: string | null = null
      try {
        deliverable = await saveViralHooksDeliverable({
          supabase,
          profileId: profile.id,
          order,
          generatedOutput: result.content.trim(),
        })
      } catch (deliverableError) {
        console.error('Viral Hooks auto-save deliverable error:', deliverableError)
        deliverableWarning = `Generated hooks are saved in Services, but the PDF could not be saved to Deliverables: ${errorMessage(deliverableError)}`
      }

      await createNotification({
        userId: profile.id,
        title: 'Your Viral Hooks are ready',
        body: deliverable
          ? `${orderNumber} is ready and the PDF was saved to Deliverables.`
          : `${orderNumber} is ready to review in Services.`,
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
        deliverable,
        deliverableWarning,
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
        await sendTransactionalEmail({
          to: notifyEmail,
          subject: `New service request ${orderNumber}: ${title}`,
          title: 'New service request',
          body: `Service: ${title}\nOrder: ${orderNumber}\nClient: ${profile.company_name || profile.full_name || profile.email}\nEmail: ${profile.email}\n\nBrief:\n${visibleBrief}`,
          link: `/admin/orders?order=${order.id}`,
          ctaLabel: 'Open admin order →',
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
