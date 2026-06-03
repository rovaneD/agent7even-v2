import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/createNotification'
import { formatOrderNumber } from '@/lib/orders/formatOrderNumber'
import { buildTextPdf } from '@/lib/pdf/textPdf'

function generatedOutputFromTicketBody(body: string | null | undefined) {
  if (!body) return ''
  const marker = '\n\nGenerated output:\n'
  const index = body.indexOf(marker)
  return index >= 0 ? body.slice(index + marker.length).trim() : ''
}

function safeFileSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'viral-hooks'
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

  const generatedOutput = messages?.[0]?.body?.trim() || generatedOutputFromTicketBody(ticket?.body)

  if (!generatedOutput) {
    return NextResponse.json({ error: 'Generated hooks output not found.' }, { status: 400 })
  }

  const orderNumber = formatOrderNumber(order)
  const projectName = 'Viral Hooks'
  const fileName = `${safeFileSegment(orderNumber)}-viral-hooks.pdf`
  const notes = `Generated from ${orderNumber}.`

  const { data: existingDeliverable } = await supabase
    .from('deliverables')
    .select('*')
    .eq('user_id', profile.id)
    .eq('project_name', projectName)
    .eq('file_name', fileName)
    .maybeSingle()

  let deliverable = existingDeliverable

  if (!deliverable) {
    const pdf = buildTextPdf(
      order.title,
      `${orderNumber} · Generated ${new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      generatedOutput
    )
    const buffer = new TextEncoder().encode(pdf)
    const filePath = `${profile.id}/${projectName.replace(/\s+/g, '_')}/${Date.now()}_${fileName}`

    const { error: storageError } = await supabase.storage
      .from('deliverables')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (storageError) {
      console.error('Viral Hooks deliverable upload error:', storageError)
      return NextResponse.json({ error: 'Could not save PDF to Deliverables.' }, { status: 500 })
    }

    const { data: insertedDeliverable, error: deliverableError } = await supabase
      .from('deliverables')
      .insert({
        user_id: profile.id,
        uploaded_by: profile.id,
        project_name: projectName,
        file_name: fileName,
        file_path: filePath,
        file_size: buffer.byteLength,
        file_type: 'application/pdf',
        notes,
        uploaded_by_role: 'admin',
      })
      .select()
      .single()

    if (deliverableError) {
      console.error('Viral Hooks deliverable record error:', deliverableError)
      await supabase.storage.from('deliverables').remove([filePath])
      return NextResponse.json({ error: 'Could not save PDF record.' }, { status: 500 })
    }

    deliverable = insertedDeliverable

    await createNotification({
      userId: profile.id,
      title: 'Viral Hooks saved to Deliverables',
      body: `${fileName} has been added to your Viral Hooks folder.`,
      type: 'deliverable_uploaded',
      link: '/dashboard/deliverables',
      sendEmail: false,
    })
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

  return NextResponse.json({ success: true, deliverable })
}
