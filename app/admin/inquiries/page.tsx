import { requireAdmin } from '@/lib/requireAdmin'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronRight, Inbox } from 'lucide-react'
import CanvasContextDispatcher from '@/components/maya/CanvasContextDispatcher'

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-600',
  reviewing: 'bg-amber-50 text-amber-600',
  proposal_sent: 'bg-purple-50 text-purple-600',
  accepted: 'bg-emerald-50 text-emerald-600',
  declined: 'bg-gray-50 text-gray-400',
}

const SERVICE_LABELS: Record<string, string> = {
  uiux: 'UI/UX Design',
  mobile_app: 'Mobile App',
  custom_dev: 'Custom Dev',
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default async function AdminInquiriesPage() {
  await requireAdmin()

  const supabase = createServiceClient()

  const { data: inquiries } = await supabase
    .from('project_inquiries')
    .select('*, profiles(full_name, company_name, email)')
    .order('created_at', { ascending: false })

  const active = inquiries?.filter(i => !['accepted', 'declined'].includes(i.status)) ?? []
  const closed = inquiries?.filter(i => ['accepted', 'declined'].includes(i.status)) ?? []

  const contextStr = [
    'ADMIN — PROJECT INQUIRIES',
    `Total: ${inquiries?.length ?? 0} (${active.length} active, ${closed.length} closed)`,
    active.length > 0
      ? `Active: ${active.map((i: any) => `${i.project_name} [${i.status}] from ${i.profiles?.company_name || i.profiles?.full_name || '—'}`).join(' | ')}`
      : 'No active inquiries',
  ].join('\n')

  return (
    <div className="px-8 py-8 max-w-6xl">
      <CanvasContextDispatcher context={contextStr} />
      <div className="mb-8">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#c8522a] mb-2">Admin</p>
        <h1 className="text-2xl font-bold text-gray-900">Project Inquiries</h1>
        <p className="text-gray-500 text-sm mt-1">
          {active.length} active · {closed.length} closed
        </p>
      </div>

      {inquiries?.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Inbox size={24} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No project inquiries yet</p>
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
                      <th className="text-left px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Project</th>
                      <th className="text-left px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Client</th>
                      <th className="text-left px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Type</th>
                      <th className="text-left px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Status</th>
                      <th className="text-left px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((inquiry: any) => (
                      <tr key={inquiry.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">{inquiry.project_name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600">
                            {inquiry.profiles?.company_name || inquiry.profiles?.full_name}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                            {SERVICE_LABELS[inquiry.service_type] ?? inquiry.service_type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_COLORS[inquiry.status] ?? 'bg-gray-50 text-gray-400'}`}>
                            {inquiry.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-400">{formatDate(inquiry.created_at)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/admin/inquiries/${inquiry.id}`}>
                            <ChevronRight size={14} className="text-gray-300 hover:text-gray-500 transition-colors" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {closed.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Closed</p>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden opacity-60">
                <table className="w-full">
                  <tbody>
                    {closed.map((inquiry: any) => (
                      <tr key={inquiry.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-6 py-3">
                          <p className="text-sm text-gray-600">{inquiry.project_name}</p>
                        </td>
                        <td className="px-6 py-3">
                          <p className="text-sm text-gray-400">
                            {inquiry.profiles?.company_name || inquiry.profiles?.full_name}
                          </p>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_COLORS[inquiry.status]}`}>
                            {inquiry.status}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <Link href={`/admin/inquiries/${inquiry.id}`}>
                            <ChevronRight size={14} className="text-gray-300 hover:text-gray-500" />
                          </Link>
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
