import { requireAdmin } from '@/lib/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Users, ShoppingBag, Headphones,
  TrendingUp, AlertCircle, Clock, ChevronRight, CheckCircle, Zap, DollarSign
} from 'lucide-react'
import CanvasContextDispatcher from '@/components/maya/CanvasContextDispatcher'

export default async function AdminPage() {
  await requireAdmin()

  const supabase = createServiceClient()

  // Fetch all key metrics in parallel
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalClients },
    { count: activeClients },
    { data: recentOrders },
    { count: openTickets },
    { data: recentClients },
    { count: atRiskClients },
    { count: agentRunsThisMonth },
    { data: agentCostData },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client').eq('status', 'active'),
    supabase.from('orders').select('*, profiles(full_name, company_name, email)').order('created_at', { ascending: false }).limit(5),
    supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('profiles').select('*').eq('role', 'client').order('created_at', { ascending: false }).limit(5),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).not('plan', 'is', null).or(`engagement_score.lt.30,last_active_at.lt.${fortyEightHoursAgo}`),
    supabase.from('agent_tasks').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
    supabase.from('agent_tasks').select('cost_usd').gte('created_at', monthStart),
  ])

  const pendingOrders = recentOrders?.filter(o => ['submitted', 'in_review'].includes(o.status)) ?? []

  const apiCostThisMonth = (agentCostData ?? []).reduce((sum: number, row: any) => sum + (row.cost_usd ?? 0), 0)

  const STATUS_COLORS: Record<string, string> = {
    submitted: 'bg-blue-50 text-blue-600',
    in_review: 'bg-yellow-50 text-yellow-600',
    in_progress: 'bg-purple-50 text-purple-600',
    delivered: 'bg-green-50 text-green-600',
    approved: 'bg-green-50 text-green-600',
    cancelled: 'bg-gray-50 text-gray-400',
    revision_requested: 'bg-orange-50 text-orange-600',
  }

  const PLAN_LABELS: Record<string, string> = {
    ai_sprint: 'AI Sprint',
    growth: 'Growth',
    done_for_you: 'Done For You',
  }

  const contextStr = [
    'ADMIN — COMMAND CENTER',
    `Total clients: ${totalClients ?? 0} (${activeClients ?? 0} active, ${atRiskClients ?? 0} at-risk)`,
    `Pending orders: ${pendingOrders.length}`,
    `Open support tickets: ${openTickets ?? 0}`,
    `Agent runs this month: ${agentRunsThisMonth ?? 0}`,
    `API cost this month: $${apiCostThisMonth.toFixed(2)}`,
    `Recent orders (${recentOrders?.length ?? 0}): ${(recentOrders ?? []).map((o: any) => `${o.title} [${o.status}]`).join(', ')}`,
    `Recent clients (${recentClients?.length ?? 0}): ${(recentClients ?? []).map((c: any) => c.company_name || c.full_name || c.email).join(', ')}`,
  ].join('\n')

  return (
    <div className="px-8 py-8 max-w-6xl">
      <CanvasContextDispatcher context={contextStr} />

      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#64748B] mb-2">Admin</p>
        <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
        <p className="text-sm text-gray-400 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total clients', value: totalClients ?? 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50', href: '/admin/clients' },
          { label: 'Active clients', value: activeClients ?? 0, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', href: '/admin/clients' },
          { label: 'Pending orders', value: pendingOrders.length, icon: ShoppingBag, color: 'text-[#64748B]', bg: 'bg-[#2D3748]/8', href: '/admin/orders' },
          { label: 'Open tickets', value: openTickets ?? 0, icon: Headphones, color: 'text-purple-500', bg: 'bg-purple-50', href: '/admin/support' },
        ].map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all group"
          >
            <div className={`w-8 h-8 rounded-lg ${metric.bg} flex items-center justify-center mb-3`}>
              <metric.icon size={15} className={metric.color} />
            </div>
            <p className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</p>
            <p className="text-xs text-gray-400">{metric.label}</p>
          </Link>
        ))}
      </div>

      {/* Second metrics row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Link
          href="/admin/clients?filter=at_risk"
          className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center mb-3">
            <AlertCircle size={15} className="text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{atRiskClients ?? 0}</p>
          <p className="text-xs text-gray-400">At-risk clients</p>
        </Link>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center mb-3">
            <Zap size={15} className="text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">{agentRunsThisMonth ?? 0}</p>
          <p className="text-xs text-gray-400">Agent runs this month</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center mb-3">
            <DollarSign size={15} className="text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">${apiCostThisMonth.toFixed(2)}</p>
          <p className="text-xs text-gray-400">API cost this month</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* Recent orders */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Recent orders</p>
            <Link href="/admin/orders" className="text-xs text-[#64748B] hover:underline">View all →</Link>
          </div>
          {recentOrders && recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order: any) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{order.title}</p>
                    <p className="text-xs text-gray-400">
                      {order.profiles?.company_name || order.profiles?.full_name || order.profiles?.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-50 text-gray-400'}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                    <ChevronRight size={12} className="text-gray-300" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <ShoppingBag size={20} className="text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No orders yet</p>
            </div>
          )}
        </div>

        {/* Recent clients */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Recent clients</p>
            <Link href="/admin/clients" className="text-xs text-[#64748B] hover:underline">View all →</Link>
          </div>
          {recentClients && recentClients.length > 0 ? (
            <div className="space-y-3">
              {recentClients.map((client: any) => (
                <Link
                  key={client.id}
                  href={`/admin/clients/${client.id}`}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#2D3748]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#64748B] text-xs font-bold">
                        {(client.company_name || client.full_name || client.email || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {client.company_name || client.full_name || client.email}
                      </p>
                      <p className="text-xs text-gray-400">{client.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {client.plan && (
                      <span className="text-[10px] font-medium text-gray-400">
                        {PLAN_LABELS[client.plan] ?? client.plan}
                      </span>
                    )}
                    <ChevronRight size={12} className="text-gray-300" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Users size={20} className="text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No clients yet</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
