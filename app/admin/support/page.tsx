import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/requireAdmin'
import Link from 'next/link'
import { MessageSquare, ChevronRight } from 'lucide-react'
import CanvasContextDispatcher from '@/components/maya/CanvasContextDispatcher'

function priorityBadge(priority: string | null) {
  const map: Record<string, string> = {
    urgent: 'bg-red-50 text-red-600',
    medium: 'bg-amber-50 text-amber-600',
    low: 'bg-gray-50 text-gray-500',
  }
  const label = priority ?? 'low'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${map[label] ?? map.low}`}>
      {label}
    </span>
  )
}

function statusBadge(status: string) {
  if (status === 'open') return (
    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Open
    </span>
  )
  return (
    <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
      Closed
    </span>
  )
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default async function AdminSupportPage() {
  await requireAdmin()

  const supabase = createServiceClient()

  const { data: tickets } = await supabase
    .from('support_tickets')
    .select(`
      *,
      profiles!support_tickets_user_id_fkey (
        full_name, company_name, email
      ),
      support_messages ( id )
    `)
    .order('updated_at', { ascending: false })

  const open = tickets?.filter(t => t.status === 'open') ?? []
  const closed = tickets?.filter(t => t.status === 'closed') ?? []

  const contextStr = [
    'ADMIN — SUPPORT',
    `Total tickets: ${tickets?.length ?? 0} (${open.length} open, ${closed.length} closed)`,
    open.length > 0
      ? `Open tickets: ${open.map((t: any) => `"${t.subject}" [${t.priority ?? 'low'}] from ${(t.profiles as any)?.company_name ?? (t.profiles as any)?.full_name ?? '—'}`).join(' | ')}`
      : 'No open tickets',
  ].join('\n')

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <CanvasContextDispatcher context={contextStr} />
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Support</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {open.length} open · {closed.length} closed
        </p>
      </div>

      {/* Open tickets */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Open tickets ({open.length})
        </h2>
        {open.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <MessageSquare size={20} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No open tickets</p>
          </div>
        ) : (
          <div className="space-y-2">
            {open.map(ticket => {
              const client = ticket.profiles as { full_name: string; company_name: string; email: string }
              return (
                <Link
                  key={ticket.id}
                  href={`/admin/support/${ticket.id}`}
                  className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 hover:border-[#c8522a]/20 hover:shadow-sm px-5 py-4 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {statusBadge(ticket.status)}
                      {priorityBadge(ticket.priority)}
                      <span className="text-xs text-gray-400">
                        {ticket.support_messages?.length ?? 0} messages
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{ticket.subject}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {client?.company_name ?? client?.full_name} · {formatDate(ticket.updated_at)}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Closed tickets */}
      {closed.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Closed tickets ({closed.length})
          </h2>
          <div className="space-y-2">
            {closed.map(ticket => {
              const client = ticket.profiles as { full_name: string; company_name: string }
              return (
                <Link
                  key={ticket.id}
                  href={`/admin/support/${ticket.id}`}
                  className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 px-5 py-4 transition-all opacity-60 hover:opacity-80"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {statusBadge(ticket.status)}
                    </div>
                    <p className="text-sm font-medium text-gray-700">{ticket.subject}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {client?.company_name ?? client?.full_name} · {formatDate(ticket.updated_at)}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
