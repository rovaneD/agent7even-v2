import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/createNotification'
import { formatOrderNumber } from '@/lib/orders/formatOrderNumber'
import { getResendClient } from '@/lib/resend'
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
      emailSubject: status === 'completed' ? `${orderNumber} is complete` : `Update on ${orderNumber}`,
    })
  }

  if (status === 'delivered' || status === 'completed') {
    if (order?.profiles?.email) {
      try {
        const resend = getResendClient()
        if (!resend) throw new Error('Missing RESEND_API_KEY')

        const orderNumber = formatOrderNumber(order)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com'
        await resend.emails.send({
          from: 'Agent7even <hello@agent7even.com>',
          to: order.profiles.email,
          subject: status === 'completed' ? `${orderNumber} is complete` : `${orderNumber} has been delivered`,
          html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
              <div style="background: #0d0d0d; padding: 24px; border-radius: 12px 12px 0 0;">
                <h2 style="color: #f0ece6; margin: 0; font-size: 18px;">${status === 'completed' ? 'Your order is complete' : 'Your delivery is ready'}</h2>
              </div>
              <div style="background: #f9f9f9; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #eee;">
                <p style="font-size: 14px; color: #555; margin: 0 0 16px;">
                  Hi ${order.profiles.full_name?.split(' ')[0] || 'there'}, <strong>${orderNumber}</strong> for <strong>${order.title}</strong> is now ${status.replace(/_/g, ' ')}.
                </p>
                <a href="${appUrl}/dashboard/services?order=${order_id}" style="display: inline-block; background: #c8522a; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600;">
                  Open order →
                </a>
              </div>
            </div>
          `,
        })
      } catch (e) {
        console.error('Delivery email failed:', e)
      }
    }
  }

  return NextResponse.json({ success: true })
}
