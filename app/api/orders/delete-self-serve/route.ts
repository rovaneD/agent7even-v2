import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { order_id } = await req.json()
  if (!order_id) return NextResponse.json({ error: 'Order ID required' }, { status: 400 })

  const supabase = createServiceClient()

  const profile = await resolveClerkProfile(supabase, userId, 'id')

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: order } = await supabase
    .from('orders')
    .select('id, service_type')
    .eq('id', order_id)
    .eq('user_id', profile.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  if (order.service_type !== 'viral_hooks') {
    return NextResponse.json({ error: 'Only self-serve Viral Hooks orders can be deleted from Services.' }, { status: 403 })
  }

  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, body')
    .eq('user_id', profile.id)
    .ilike('subject', 'Self-serve service:%')

  const relatedTicketIds = (tickets ?? [])
    .filter(ticket => typeof ticket.body === 'string' && ticket.body.includes(`Order ID: ${order.id}`))
    .map(ticket => ticket.id)

  if (relatedTicketIds.length > 0) {
    await supabase.from('support_messages').delete().in('ticket_id', relatedTicketIds)
    await supabase.from('support_tickets').delete().in('id', relatedTicketIds)
  }

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', order.id)
    .eq('user_id', profile.id)
    .eq('service_type', 'viral_hooks')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
