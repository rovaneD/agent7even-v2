// app/admin/revenue/AdminAgentCosts.tsx
// Add to admin revenue tab — shows real agent cost data

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CostRow {
  model: string
  runs: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  avg_cost_usd: number
}

interface OrchestrationRow {
  id: string
  triggered_by: string
  status: string
  total_cost_usd: number
  total_tasks: number
  budget_cap_usd: number
  budget_exceeded: boolean
  created_at: string
}

export default function AdminAgentCosts() {
  const [costByModel, setCostByModel] = useState<CostRow[]>([])
  const [recentOrchestrations, setRecentOrchestrations] = useState<OrchestrationRow[]>([])
  const [totalThisMonth, setTotalThisMonth] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      // Cost by model this month
      const { data: tasks } = await supabase
        .from('agent_tasks')
        .select('model, input_tokens, output_tokens, cost_usd')
        .eq('status', 'completed')
        .gte('created_at', startOfMonth.toISOString())

      let modelRows: CostRow[] = []
      if (tasks) {
        const grouped: Record<string, CostRow> = {}
        for (const t of tasks) {
          if (!t.model) continue
          if (!grouped[t.model]) {
            grouped[t.model] = {
              model: t.model, runs: 0,
              total_input_tokens: 0, total_output_tokens: 0,
              total_cost_usd: 0, avg_cost_usd: 0
            }
          }
          grouped[t.model].runs++
          grouped[t.model].total_input_tokens  += t.input_tokens  ?? 0
          grouped[t.model].total_output_tokens += t.output_tokens ?? 0
          grouped[t.model].total_cost_usd      += t.cost_usd      ?? 0
        }
        modelRows = Object.values(grouped).map(r => ({
          ...r,
          avg_cost_usd: r.runs > 0 ? r.total_cost_usd / r.runs : 0
        }))
        setCostByModel(modelRows)
        setTotalThisMonth(modelRows.reduce((s, r) => s + r.total_cost_usd, 0))
      }

      // Recent orchestrations
      const { data: orchs } = await supabase
        .from('orchestration_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (orchs) setRecentOrchestrations(orchs)

      const totalCost = modelRows.reduce((s, r) => s + r.total_cost_usd, 0)
      const lines = [
        'ADMIN — REVENUE: AGENT COSTS',
        `Total agent API cost this month: $${totalCost.toFixed(4)}`,
        modelRows.length > 0
          ? `Cost by model: ${modelRows.map(r => `${r.model} — ${r.runs} runs, $${r.total_cost_usd.toFixed(4)}`).join(' | ')}`
          : 'No model data',
        orchs && orchs.length > 0
          ? `Recent orchestrations: ${orchs.slice(0, 5).map((o: OrchestrationRow) => `${o.triggered_by} [${o.status}] $${(o.total_cost_usd ?? 0).toFixed(4)}`).join(' | ')}`
          : 'No recent orchestrations',
      ]
      window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context: lines.join('\n') } }))
    }
    load()
  }, [])

  return (
    <div className="space-y-8">

      {/* Month summary */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-1">Agent API cost — this month</h3>
        <p className="text-3xl font-semibold text-gray-900">
          ${totalThisMonth.toFixed(4)}
        </p>
        <p className="text-xs text-gray-400 mt-1">Actual Anthropic/OpenRouter charges</p>
      </div>

      {/* Cost by model */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="font-medium text-gray-900 mb-4">Cost by model</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100">
              <th className="pb-2">Model</th>
              <th className="pb-2 text-right">Runs</th>
              <th className="pb-2 text-right">Tokens in</th>
              <th className="pb-2 text-right">Tokens out</th>
              <th className="pb-2 text-right">Total cost</th>
              <th className="pb-2 text-right">Avg/run</th>
            </tr>
          </thead>
          <tbody>
            {costByModel.map(row => (
              <tr key={row.model} className="border-b border-gray-50 last:border-0">
                <td className="py-2 font-mono text-xs text-gray-600">{row.model}</td>
                <td className="py-2 text-right">{row.runs}</td>
                <td className="py-2 text-right text-gray-500">{row.total_input_tokens.toLocaleString()}</td>
                <td className="py-2 text-right text-gray-500">{row.total_output_tokens.toLocaleString()}</td>
                <td className="py-2 text-right font-medium">${row.total_cost_usd.toFixed(4)}</td>
                <td className="py-2 text-right text-gray-500">${row.avg_cost_usd.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent orchestrations */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="font-medium text-gray-900 mb-4">Recent orchestrations</h3>
        <div className="space-y-3">
          {recentOrchestrations.map(o => (
            <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{o.triggered_by}</p>
                <p className="text-xs text-gray-400">{o.total_tasks} tasks · {new Date(o.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">${(o.total_cost_usd ?? 0).toFixed(4)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  o.budget_exceeded
                    ? 'bg-red-50 text-red-600'
                    : o.status === 'completed'
                    ? 'bg-green-50 text-green-600'
                    : 'bg-yellow-50 text-yellow-600'
                }`}>
                  {o.budget_exceeded ? 'budget hit' : o.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
