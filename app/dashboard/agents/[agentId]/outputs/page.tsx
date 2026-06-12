import Link from 'next/link'
import CanvasContextDispatcher from '@/components/maya/CanvasContextDispatcher'
import { buildAgentOutputsMayaContext } from '@/lib/maya/summaries/phase3Context'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { contentPostingStatsAgentIds } from '@/lib/agents/contentPosting'
import { AGENTS, type AgentId } from '@/lib/agents/registry'
import AgentOutputDetail from './AgentOutputDetail'

type AgentOutput = {
  id: string
  task_id: string
  agent: string
  output_type: string
  title: string
  content: { raw?: string; parsed?: Record<string, unknown> } | string | null
  status: string
  created_at: string
}

function isAgentId(value: string): value is AgentId {
  return value in AGENTS
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getOutputText(output: AgentOutput): string {
  const content = output.content
  if (!content) return ''
  if (typeof content === 'string') return content
  if (typeof content.raw === 'string') return content.raw
  if (content.parsed) return JSON.stringify(content.parsed, null, 2)
  return JSON.stringify(content, null, 2)
}

function getOutputDescription(output: AgentOutput): string {
  const raw = getOutputText(output)
  const firstHeading = raw
    .split('\n')
    .map(line => line.trim())
    .find(line => line.startsWith('#'))
    ?.replace(/^#+\s*/, '')

  if (firstHeading) return firstHeading
  if (output.title) return output.title
  return raw.slice(0, 120) || 'Saved agent output'
}

export default async function AgentOutputsPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>
  searchParams: Promise<{ output?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { agentId: rawAgentId } = await params
  if (!isAgentId(rawAgentId)) notFound()

  const { output: selectedOutputParam } = await searchParams
  const agent = AGENTS[rawAgentId]
  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, company_name')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  const profile = profileRows?.[0] ?? null

  if (!profile) redirect('/foundation')

  const outputAgentIds = rawAgentId === 'content_posting'
    ? contentPostingStatsAgentIds()
    : [rawAgentId]

  const { data: outputs } = await supabase
    .from('agent_outputs')
    .select('id, task_id, agent, output_type, title, content, status, created_at')
    .eq('user_id', profile.id)
    .in('agent', outputAgentIds)
    .order('created_at', { ascending: false })
    .limit(100)

  const outputRows = (outputs ?? []) as AgentOutput[]
  const selectedOutput =
    outputRows.find(output => output.id === selectedOutputParam) ??
    outputRows[0] ??
    null

  const mayaPayload = buildAgentOutputsMayaContext({
    agentName: agent.name,
    companyName: profile.company_name ?? 'Your business',
    outputCount: outputRows.length,
    selectedTitle: selectedOutput ? getOutputDescription(selectedOutput) : null,
    selectedStatus: selectedOutput?.status ?? null,
    autonomyLevel: agent.autonomyLevel,
  })

  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-8 pb-16 sm:px-8" style={{ fontFamily: 'var(--font-geist), system-ui, sans-serif' }}>
      <CanvasContextDispatcher payload={mayaPayload} />
      <Link href="/dashboard/agents" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: 12.5, textDecoration: 'none', marginBottom: 22 }}>
        <i className="ti ti-arrow-left" style={{ fontSize: 14 }} />
        Back to Command Center
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748B', marginBottom: 4 }}>Agent outputs</p>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#2D3748', margin: '0 0 4px' }}>
            {agent.name}
          </h1>
          <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
            {profile.company_name ?? 'Your business'} · {outputRows.length} saved output{outputRows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, borderRadius: 20, padding: '5px 10px', background: agent.autonomyLevel === 'autonomous' ? '#EFF6FF' : '#F8FAFC', color: agent.autonomyLevel === 'autonomous' ? '#3B82F6' : '#64748B', fontWeight: 600 }}>
          <i className={`ti ${agent.icon}`} style={{ fontSize: 14 }} />
          {agent.autonomyLevel === 'autonomous' ? 'Auto' : 'Approval'}
        </span>
      </div>

      {selectedOutput ? (
        <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[320px_1fr]">
          <aside style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Archive</p>
            </div>
            <div className="max-h-[280px] overflow-y-auto lg:max-h-[620px]">
              {outputRows.map(output => {
                const selected = output.id === selectedOutput.id
                return (
                  <Link
                    key={output.id}
                    href={`/dashboard/agents/${rawAgentId}/outputs?output=${output.id}`}
                    style={{ display: 'block', padding: '13px 16px', borderBottom: '1px solid #F1F5F9', background: selected ? '#EFF6FF' : '#fff', textDecoration: 'none' }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#2D3748', margin: '0 0 4px', lineHeight: 1.35 }}>
                      {getOutputDescription(output)}
                    </p>
                    <p style={{ fontSize: 11.5, color: '#64748B', margin: 0 }}>
                      {relativeTime(output.created_at)} · {output.status.replace(/_/g, ' ')}
                    </p>
                  </Link>
                )
              })}
            </div>
          </aside>

          <AgentOutputDetail
            agentName={agent.name}
            taskId={selectedOutput.task_id}
            outputId={selectedOutput.id}
            title={getOutputDescription(selectedOutput)}
            subtitle={`${selectedOutput.title || agent.name} · ${relativeTime(selectedOutput.created_at)}`}
            status={selectedOutput.status}
            content={getOutputText(selectedOutput)}
          />
        </div>
      ) : (
        <div style={{ background: '#FFFFFF', border: '1px dashed #CBD5E1', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <i className={`ti ${agent.icon}`} style={{ fontSize: 20, color: '#CBD5E1' }} />
          </div>
          <p style={{ fontSize: 14, color: '#2D3748', fontWeight: 600, margin: '0 0 4px' }}>No outputs yet</p>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>{agent.name} has not saved an output for this account.</p>
        </div>
      )}
    </div>
  )
}
