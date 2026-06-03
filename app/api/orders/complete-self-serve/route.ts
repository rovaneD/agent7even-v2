import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { saveViralHooksDeliverable } from '@/lib/services/saveViralHooksDeliverable'
import { extractViralHooksGeneratedOutput } from '@/lib/services/viralHooks'

function generatedOutputFromTicketBody(body: string | null | undefined) {
  if (!body) return ''
  const marker = '\n\nGenerated output:\n'
  const index = body.indexOf(marker)
  return index >= 0 ? body.slice(index + marker.length).trim() : ''
}

function errorMessage(error: unknown) {
  if (!error) return 'Unknown error'
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return String(error)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { order_id } = await req.json()
  if (!order_id) return NextResponse.json({ error: 'Order ID required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', order_id)
    .eq('user_id', profile.id)
    .eq('service_type', 'viral_hooks')
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const { data: serviceTickets } = await supabase
    .from('support_tickets')
    .select('id, body')
    .eq('user_id', profile.id)
    .ilike('subject', 'Self-serve service:%')
    .order('updated_at', { ascending: false })

  const ticket = (serviceTickets ?? []).find(item => {
    const match = typeof item.body === 'string' ? item.body.match(/Order ID:\s*([a-f0-9-]+)/i) : null
    return match?.[1] === order.id
  })

  const { data: messages } = ticket
    ? await supabase
      .from('support_messages')
      .select('body, sender_role, created_at')
      .eq('ticket_id', ticket.id)
      .neq('sender_role', 'client')
      .order('created_at', { ascending: true })
    : { data: [] }

  const generatedOutput = extractViralHooksGeneratedOutput(order.brief)
    || messages?.[0]?.body?.trim()
    || generatedOutputFromTicketBody(ticket?.body)

  let deliverable = null
  let warning: string | null = null
  if (generatedOutput) {
    try {
      deliverable = await saveViralHooksDeliverable({
        supabase,
        profileId: profile.id,
        order,
        generatedOutput,
      })
    } catch (deliverableError) {
      console.error('Viral Hooks deliverable save error:', deliverableError)
      warning = `Marked complete, but the PDF could not be saved to Deliverables: ${errorMessage(deliverableError)}`
    }
  } else {
    warning = 'Marked complete, but no generated hooks output was found to save as a PDF.'
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order_id)
    .eq('user_id', profile.id)
    .eq('service_type', 'viral_hooks')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, deliverable, warning })
}
