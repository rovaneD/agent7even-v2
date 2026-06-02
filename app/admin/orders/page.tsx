import { requireAdmin } from '@/lib/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronRight, Mail, MessageSquare, ShoppingBag } from 'lucide-react'
import CanvasContextDispatcher from '@/components/maya/CanvasContextDispatcher'

export const dynamic = 'force-dynamic'

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-50 text-blue-600',
  in_review: 'bg-yellow-50 text-yellow-600',
  in_progress: 'bg-purple-50 text-purple-600',
  delivered: 'bg-green-50 text-green-600',
  approved: 'bg-green-50 text-green-600',
  cancelled: 'bg-gray-50 text-gray-400',
  revision_requested: 'bg-orange-50 text-orange-600',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-50 text-gray-400',
  medium: 'bg-blue-50 text-blue-500',
  high: 'bg-red-50 text-red-500',
}

function briefPreview(brief: string | null | undefined) {
  if (!brief) return 'No brief provided.'
  return brief.length > 180 ? `${brief.slice(0, 180)}...` : brief
}

export default async function AdminOrdersPage() {
  await requireAdmin()
  const supabase = createServiceClient()

  const { data: orderRows, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (ordersError) console.error('[admin/orders] orders query error:', ordersError.message)

  const rawOrders = orderRows ?? []
  const profileIds = [...new Set(rawOrders.map((order: any) => order.user_id).filter(Boolean))]
  const { data: profiles } = profileIds.length
    ? await supabase
      .from('profiles')
      .select('id, full_name, company_name, email')
      .in('id', profileIds)
    : { data: [] }

  const profilesById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]))
  const orders = rawOrders.map((order: any) => ({
    ...order,
    profiles: profilesById.get(order.user_id) ?? null,
  }))

  const userIds = [...new Set((orders ?? []).map((order: any) => order.user_id).filter(Boolean))]
  const { data: serviceTickets } = userIds.length
    ? await supabase
      .from('support_tickets')
      .select('id, user_id, subject, body, status')
      .in('user_id', userIds)
      .ilike('subject', 'Service request:%')
      .order('updated_at', { ascending: false })
    : { data: [] }

  const supportTicketByOrderId = new Map<string, any>()
  for (const ticket of serviceTickets ?? []) {
    const match = typeof ticket.body === 'string' ? ticket.body.match(/Order ID:\s*([a-f0-9-]+)/i) : null
    const orderId = match?.[1]
    if (orderId && !supportTicketByOrderId.has(orderId)) {
      supportTicketByOrderId.set(orderId, ticket)
    }
  }

  const active = orders?.filter(o => !['approved', 'cancelled'].includes(o.status)) ?? []
  const completed = orders?.filter(o => ['approved', 'cancelled'].includes(o.status)) ?? []

  const contextStr = [
    'ADMIN — ORDERS',
    `Total: ${orders?.length ?? 0} (${active.length} active, ${completed.length} completed)`,
    active.length > 0
      ? `Active orders: ${active.map((o: any) => `${o.title} [${o.status}] — ${o.profiles?.company_name || o.profiles?.full_name || o.profiles?.email || '—'}`).join(' | ')}`
      : 'No active orders',
  ].join('\n')

  return (
    <div className="px-8 py-8 max-w-6xl">
      <CanvasContextDispatcher context={contextStr} />
      <div className="mb-8">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#64748B] mb-2">Admin</p>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 text-sm mt-1">{active.length} active · {completed.length} completed</p>
      </div>

      {orders?.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <ShoppingBag size={24} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Active</p>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Service</th>
                      <th className="text-left px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Client</th>
                      <th className="text-left px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Status</th>
                      <th className="text-left px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Priority</th>
                      <th className="text-left px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((order: any) => {
                      const clientName = order.profiles?.company_name || order.profiles?.full_name || order.profiles?.email || 'Unknown client'
                      const clientEmail = order.profiles?.email
                      const ticket = supportTicketByOrderId.get(order.id)
                      return (
                      <tr key={order.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors align-top">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">{order.title}</p>
                          <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">{briefPreview(order.brief)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600">
                            {clientName}
                          </p>
                          {clientEmail && <p className="text-xs text-gray-400 mt-1">{clientEmail}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-50 text-gray-400'}`}>
                            {order.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${PRIORITY_COLORS[order.priority] ?? 'bg-gray-50 text-gray-400'}`}>
                            {order.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-400">
                            {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {ticket && (
                              <Link
                                href={`/admin/support/${ticket.id}`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#3B82F6] hover:text-[#1D4ED8]"
                              >
                                <MessageSquare size={13} />
                                Follow up
                              </Link>
                            )}
                            {clientEmail && (
                              <a
                                href={`mailto:${clientEmail}?subject=${encodeURIComponent(`Re: ${order.title} request`)}`}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-gray-100 text-gray-400 hover:text-gray-600 hover:border-gray-200"
                                title="Email client"
                              >
                                <Mail size={13} />
                              </a>
                            )}
                            <Link href={`/admin/clients/${order.user_id}`} title="View client">
                              <ChevronRight size={14} className="text-gray-300 hover:text-gray-500 transition-colors" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Completed</p>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden opacity-60">
                <table className="w-full">
                  <tbody>
                    {completed.map((order: any) => (
                      <tr key={order.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-6 py-3">
                          <p className="text-sm text-gray-600">{order.title}</p>
                          <p className="text-xs text-gray-400 mt-1">{briefPreview(order.brief)}</p>
                        </td>
                        <td className="px-6 py-3">
                          <p className="text-sm text-gray-400">
                            {order.profiles?.company_name || order.profiles?.full_name || order.profiles?.email}
                          </p>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status]}`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
