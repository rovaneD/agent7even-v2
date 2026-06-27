'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Loader2,
  Plug,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import type { IntegrationHealthItem, IntegrationsHealthReport } from '@/lib/integrationsHealth'

function StatusIcon({ status }: { status: IntegrationHealthItem['status'] }) {
  if (status === 'ok') return <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
  if (status === 'warning') return <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
  if (status === 'error') return <XCircle size={16} className="text-red-500 flex-shrink-0" />
  return <HelpCircle size={16} className="text-gray-300 flex-shrink-0" />
}

function statusLabel(status: IntegrationHealthItem['status']): string {
  if (status === 'ok') return 'OK'
  if (status === 'warning') return 'Warning'
  if (status === 'error') return 'Error'
  return 'Not configured'
}

function statusBadgeClass(status: IntegrationHealthItem['status']): string {
  if (status === 'ok') return 'bg-emerald-50 text-emerald-700'
  if (status === 'warning') return 'bg-amber-50 text-amber-700'
  if (status === 'error') return 'bg-red-50 text-red-700'
  return 'bg-gray-50 text-gray-500'
}

export default function IntegrationsHealthSection() {
  const [report, setReport] = useState<IntegrationsHealthReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/integrations/health', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load integration health.')
        setReport(null)
        return
      }
      setReport(json as IntegrationsHealthReport)
    } catch {
      setError('Network error while checking integrations.')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#2D3748]/10 flex items-center justify-center flex-shrink-0">
            <Plug size={18} className="text-[#64748B]" />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-[#2D3748]">Integrations health</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Environment and live checks for OAuth and third-party services. No secrets are shown.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 text-xs font-semibold text-[#64748B] border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 mb-4">
          <p className="text-xs font-medium text-red-600">{error}</p>
        </div>
      )}

      {loading && !report && !error && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Checking integrations…
        </div>
      )}

      {report && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-5 text-xs text-gray-400">
            <span>
              Checked {new Date(report.checkedAt).toLocaleString()}
            </span>
            {report.deployment.vercelEnv && (
              <span className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100">
                {report.deployment.vercelEnv}
              </span>
            )}
            {report.deployment.appUrl && (
              <span className="truncate max-w-xs">{report.deployment.appUrl}</span>
            )}
            {!report.allOk && (
              <span className="text-red-500 font-medium">Action required</span>
            )}
          </div>

          <div className="space-y-3">
            {report.items.map(item => (
              <div
                key={item.id}
                className="rounded-xl border border-gray-100 px-4 py-3.5"
              >
                <div className="flex items-start gap-3">
                  <StatusIcon status={item.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusBadgeClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{item.message}</p>
                    {item.hint && item.status !== 'ok' && (
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">{item.hint}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-gray-400 mt-5 leading-relaxed">
            Google Analytics OAuth runs a live token refresh when any tenant has connected GA.
            After updating Vercel env vars, redeploy then refresh this page before asking customers to reconnect.
          </p>
        </>
      )}
    </div>
  )
}
