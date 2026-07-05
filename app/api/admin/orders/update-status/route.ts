import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/createNotification'
import { formatOrderNumber } from '@/lib/orders/formatOrderNumber'
import { requireAdminApi, adminApiError } from '@/lib/requireAdmin'

export async function POST(req: NextRequest) {
  const authResult = await requireAdminApi()
  if ('error' in authResult) return adminApiError(authResult)
  const { admin } = authResult

  const supabase = createServiceClient()

  const { order_id, status } = await req.json()

  const validStatuses = ['submitted', 'in_review', 'in_progress', 'delivered', 'revision_requested', 'approved', 'completed', 'cancelled']
  if (!order_id || !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const dbStatus = status === 'completed' ? 'approved' : status

  const { error } = await supabase
    .from('orders')
    .update({
      status: dbStatus,
      ...(dbStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
      ...(dbStatus === 'approved' ? { approved_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the client on status changes
  const { data: order } = await supabase
    .from('orders')
    .select('id, user_id, title, created_at, profiles(email, full_name)')
    .eq('id', order_id)
    .single() as any

  if (order?.user_id) {
    const orderNumber = formatOrderNumber(order)
    const statusLabel = status.replace(/_/g, ' ')
    const isFinalDelivery = status === 'delivered' || status === 'completed'

    await createNotification({
      userId: order.user_id,
      title: status === 'completed' ? 'Your order is complete' : status === 'delivered' ? 'Your order has been delivered' : 'Order status updated',
      body: `${orderNumber} for ${order.title} is now ${statusLabel}.`,
      type: isFinalDelivery ? 'order_delivered' : 'order_status',
      link: `/dashboard/services?order=${order_id}`,
      sendEmail: isFinalDelivery,
      emailSubject: status === 'completed' ? `${orderNumber} is complete` : `${orderNumber} has been delivered`,
    })
  }

  return NextResponse.json({ success: true })
}
