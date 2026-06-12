'use client'

import { useState } from 'react'
import { CheckCircle2, Clock, Zap, FileText, ChevronRight, Bot, AlertCircle, Sparkles } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { AGENTS, type AgentId, type AgentDefinition } from '@/lib/agents/registry'

const AGENT_COLORS: Record<AgentId, { bg: string; fg: string }> = {
  competitor_watcher:     { bg: '#C5F9CD', fg: '#15803D' },
  content_posting:        { bg: '#DBEAFE', fg: '#1D4ED8' },
  weekly_content:         { bg: '#C5EFF9', fg: '#0369A1' },
  post_caption:           { bg: '#DBEAFE', fg: '#1D4ED8' },
  campaign_builder:       { bg: '#F7C5F9', fg: '#7E22CE' },
  performance_digest:     { bg: '#C5F9EC', fg: '#0F766E' },
  trend_spotter:          { bg: '#FFE3AD', fg: '#92400E' },
  email_sequence_builder: { bg: '#EAE1F9', fg: '#6D28D9' },
  ad_variations:          { bg: '#E6F4AD', fg: '#3F6212' },
  seo_scanner:            { bg: '#AFDAF7', fg: '#075985' },
  brand_voice_guardian:   { bg: '#E2F7F2', fg: '#065F46' },
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_RUNNING = [
  { id: '1', agent: 'performance_digest', startedAt: '3 min ago' },
  { id: '2', agent: 'trend_spotter',      startedAt: '7 min ago' },
]

const MOCK_QUEUED = [
  { id: '3', agent: 'competitor_watcher' },
]

const MOCK_COMPLETED_TODAY = [
  { id: '4', agent: 'weekly_content',    completedAt: '1 hr ago' },
  { id: '5', agent: 'seo_scanner',       completedAt: '4 hrs ago' },
]

const MOCK_PENDING_APPROVALS = [
  { id: '6', agent: 'campaign_builder',    title: 'Summer launch — 30-day campaign' },
  { id: '7', agent: 'email_sequence_builder', title: 'Welcome sequence — 5 emails' },
]

const MOCK_RECENT_OUTPUTS = [
  { id: 'o1', agent: 'performance_digest',     title: 'Weekly performance recap — May 28',    status: 'approved',         time: '2h ago' },
  { id: 'o2', agent: 'competitor_watcher',     title: 'Competitor report — local market scan', status: 'approved',         time: '1d ago' },
  { id: 'o3', agent: 'campaign_builder',       title: 'Summer launch — 30-day campaign',       status: 'pending_approval', time: '2d ago' },
  { id: 'o4', agent: 'weekly_content',         title: 'Week of Jun 2 — social + email drafts', status: 'approved',         time: '3d ago' },
  { id: 'o5', agent: 'email_sequence_builder', title: 'Welcome sequence — 5 emails',           status: 'pending_approval', time: '3d ago' },
]

const MOCK_SCORECARD = Object.values(AGENTS).map((agent, i) => ({
  agentId: agent.id,
  name: agent.name,
  icon: agent.icon,
  lastRunAt: i < 5 ? ['2h ago', '1d ago', '3d ago', '1w ago', '2w ago'][i] : null,
  totalOutputs: [12, 8, 4, 31, 7, 2, 5, 9, 14][i] ?? 0,
  isScheduled: agent.autonomyLevel === 'autonomous',
}))

// ── Agent guided config (abbreviated — 2 fields each) ─────────────────────────

const QUICK_FIELDS: Partial<Record<AgentId, { label: string; placeholder: string; type?: 'select'; options?: string[] }[]>> = {
  competitor_watcher: [
    { label: 'Watch focus', type: 'select', placeholder: '', options: ['General market', 'Pricing/offers', 'Social content', 'Positioning'] },
    { label: 'Competitors to watch', placeholder: 'Leave blank to use Foundation competitors.' },
  ],
  weekly_content: [
    { label: 'Week goal', placeholder: 'Lead gen, launch support, retention…' },
    { label: 'Platforms', placeholder: 'Instagram, LinkedIn, email…' },
  ],
  campaign_builder: [
    { label: 'Campaign goal', placeholder: 'Launch, seasonal promo, re-engagement…' },
    { label: 'Budget', placeholder: 'Total or monthly ad spend' },
  ],
  performance_digest: [
    { label: 'Focus area', type: 'select', placeholder: '', options: ['All channels', 'Social only', 'Ads only', 'Website only'] },
    { label: 'Key questions', placeholder: 'What should the digest answer this week?' },
  ],
  trend_spotter: [
    { label: 'Industry / niche', placeholder: 'E.g. local service, ecommerce, wellness…' },
    { label: 'Content types', placeholder: 'Formats or topics to watch for' },
  ],
  email_sequence_builder: [
    { label: 'Sequence type', type: 'select', placeholder: '', options: ['Welcome', 'Nurture', 'Promotional', 'Re-engagement', 'Post-purchase'] },
    { label: 'Goal', placeholder: 'What should this sequence move people toward?' },
  ],
  ad_variations: [
    { label: 'Product / offer', placeholder: 'What are we advertising?' },
    { label: 'Audience', placeholder: 'Who should see this?' },
  ],
  seo_scanner: [
    { label: 'Website URL', placeholder: 'https://yoursite.com' },
    { label: 'Focus', type: 'select', placeholder: '', options: ['Full audit', 'On-page only', 'Technical only', 'Content gaps'] },
  ],
  brand_voice_guardian: [
    { label: 'Content to review', placeholder: 'Paste the content or describe what to check.' },
    { label: 'Strictness', type: 'select', placeholder: '', options: ['Strict', 'Balanced', 'Light touch'] },
  ],
}

// ── Small shared components ────────────────────────────────────────────────────

function AgentIcon({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' | 'lg' }) {
  const colors = AGENT_COLORS[id as AgentId]
  const icon = AGENTS[id as AgentId]?.icon ?? 'ti-robot'
  const dim = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 22 : 16
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-full ${dim}`}
      style={{ backgroundColor: colors?.bg ?? '#F3F4F6', color: colors?.fg ?? '#6B7280' }}
    >
      <i className={`ti ${icon}`} style={{ fontSize }} />
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    approved:         { label: 'Approved',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    pending_approval: { label: 'Review',    className: 'bg-amber-50  text-amber-700  border-amber-200'  },
    running:          { label: 'Running',   className: 'bg-blue-50   text-blue-700   border-blue-200'   },
    pending:          { label: 'Queued',    className: 'bg-gray-50   text-gray-600   border-gray-200'   },
    completed:        { label: 'Done',      className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  }
  const s = map[status] ?? { label: status, className: 'bg-gray-50 text-gray-500 border-gray-200' }
  return <Badge variant="outline" className={`text-[10px] font-medium ${s.className}`}>{s.label}</Badge>
}

// ── Agent card grid ────────────────────────────────────────────────────────────

function AgentCard({
  agent, isSelected, onClick,
}: {
  agent: AgentDefinition
  isSelected: boolean
  onClick: () => void
}) {
  const colors = AGENT_COLORS[agent.id]
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col gap-3 rounded-xl border p-4 text-left transition-all ${
        isSelected
          ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300'
          : 'border-border bg-card hover:border-gray-300 hover:bg-muted/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
          style={isSelected
            ? { backgroundColor: 'rgba(59,130,246,0.12)', color: '#3B82F6' }
            : { backgroundColor: colors?.bg, color: colors?.fg }
          }
        >
          <i className={`ti ${agent.icon}`} style={{ fontSize: 18 }} />
        </span>
        <Badge
          variant="outline"
          className={`text-[10px] ${
            agent.autonomyLevel === 'autonomous'
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-gray-50 text-gray-500'
          }`}
        >
          {agent.autonomyLevel === 'autonomous' ? 'Auto' : 'Approval'}
        </Badge>
      </div>
      <div>
        <p className="text-sm font-semibold">{agent.name}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{agent.description}</p>
      </div>
    </button>
  )
}

// ── Run agent panel ────────────────────────────────────────────────────────────

function RunAgentPanel() {
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [extra, setExtra] = useState('')
  const [priority, setPriority] = useState<'normal' | 'high'>('normal')
  const [submitted, setSubmitted] = useState(false)

  const agentList = Object.values(AGENTS)
  const fields = selectedAgent ? (QUICK_FIELDS[selectedAgent] ?? []) : []

  function handleRun() {
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setSelectedAgent(null)
      setFieldValues({})
      setExtra('')
    }, 2500)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Run an agent</CardTitle>
        <CardDescription className="text-xs">Choose the specialist for this task.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Grid */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {agentList.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isSelected={selectedAgent === agent.id}
              onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id as AgentId)}
            />
          ))}
        </div>

        {/* Guided setup */}
        {selectedAgent && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/60 px-4 py-3">
                <p className="text-sm font-medium">{AGENTS[selectedAgent].name} setup</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Fill in the details so the output comes back ready to review, not a generic draft.
                </p>
              </div>

              {fields.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {fields.map(field => (
                    <div key={field.label} className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {field.label}
                      </label>
                      {field.type === 'select' ? (
                        <Select
                          value={fieldValues[field.label] ?? ''}
                          onValueChange={(v) => v && setFieldValues(p => ({ ...p, [field.label]: v }))}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options?.map(o => (
                              <SelectItem key={o} value={o} className="text-sm">{o}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={fieldValues[field.label] ?? ''}
                          onChange={e => setFieldValues(p => ({ ...p, [field.label]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="h-9 text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Additional instructions
                </label>
                <Textarea
                  value={extra}
                  onChange={e => setExtra(e.target.value)}
                  placeholder={`Optional: anything specific ${AGENTS[selectedAgent].name} should know for this run.`}
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex rounded-md border text-xs overflow-hidden">
                  {(['normal', 'high'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-3 py-1.5 capitalize font-medium transition-colors ${
                        priority === p ? 'bg-foreground text-background' : 'hover:bg-muted'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleRun}
                  disabled={submitted}
                  className={`ml-auto rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                    submitted ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {submitted ? '✓ Task queued' : `Run ${AGENTS[selectedAgent].name}`}
                </button>
              </div>
            </div>
          </>
        )}

        {!selectedAgent && (
          <p className="py-4 text-center text-sm text-muted-foreground">Select an agent above to get started.</p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Live activity feed ─────────────────────────────────────────────────────────

function LiveActivity() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Live activity</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-5 p-0 px-5 pb-5">

        {MOCK_RUNNING.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Running now</p>
            {MOCK_RUNNING.map(t => (
              <div key={t.id} className="flex items-center gap-3 py-2">
                <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-emerald-500" />
                <AgentIcon id={t.agent} size="sm" />
                <span className="flex-1 text-sm font-medium">{AGENTS[t.agent as AgentId]?.name}</span>
                <span className="text-xs text-muted-foreground">{t.startedAt}</span>
              </div>
            ))}
          </div>
        )}

        {MOCK_QUEUED.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Queued</p>
            {MOCK_QUEUED.map(t => (
              <div key={t.id} className="flex items-center gap-3 py-2">
                <span className="h-2 w-2 flex-shrink-0 rounded-full bg-gray-300" />
                <AgentIcon id={t.agent} size="sm" />
                <span className="flex-1 text-sm text-muted-foreground">{AGENTS[t.agent as AgentId]?.name}</span>
                <span className="text-xs text-muted-foreground">Waiting</span>
              </div>
            ))}
          </div>
        )}

        {MOCK_COMPLETED_TODAY.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Completed today</p>
            {MOCK_COMPLETED_TODAY.map(t => (
              <div key={t.id} className="flex items-center gap-3 py-2">
                <CheckCircle2 size={13} className="flex-shrink-0 text-emerald-500" />
                <AgentIcon id={t.agent} size="sm" />
                <span className="flex-1 text-sm text-muted-foreground">{AGENTS[t.agent as AgentId]?.name}</span>
                <span className="text-xs text-muted-foreground">{t.completedAt}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Agent scorecard ────────────────────────────────────────────────────────────

function AgentScorecard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Agent scorecard</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[340px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5 text-xs">Agent</TableHead>
                <TableHead className="text-xs">Last run</TableHead>
                <TableHead className="text-xs text-center">Outputs</TableHead>
                <TableHead className="pr-5 text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_SCORECARD.map(entry => (
                <TableRow key={entry.agentId}>
                  <TableCell className="pl-5">
                    <div className="flex items-center gap-2.5">
                      <AgentIcon id={entry.agentId} size="sm" />
                      <span className="text-sm font-medium whitespace-nowrap">{entry.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {entry.lastRunAt ?? '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-sm font-semibold ${entry.totalOutputs > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                      {entry.totalOutputs}
                    </span>
                  </TableCell>
                  <TableCell className="pr-5">
                    {entry.isScheduled ? (
                      <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Idle</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ── Recent outputs ─────────────────────────────────────────────────────────────

function RecentOutputs() {
  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm">Recent outputs</CardTitle>
          <CardDescription className="text-xs mt-0.5">Open an output archive to read the full result.</CardDescription>
        </div>
        <button className="text-xs font-semibold text-blue-600 hover:underline">Review approvals</button>
      </CardHeader>
      <CardContent className="space-y-2">
        {MOCK_RECENT_OUTPUTS.map(output => (
          <div
            key={output.id}
            className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/40 cursor-pointer"
          >
            <AgentIcon id={output.agent} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{output.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {AGENTS[output.agent as AgentId]?.name} · {output.time}
              </p>
            </div>
            <StatusBadge status={output.status} />
            <ChevronRight size={14} className="flex-shrink-0 text-muted-foreground" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LabAgentsPage() {
  const running  = MOCK_RUNNING.length
  const queued   = MOCK_QUEUED.length
  const approvals = MOCK_PENDING_APPROVALS.length
  const outputs  = MOCK_RECENT_OUTPUTS.length

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">Agent Command Center</h1>
            <p className="text-xs text-muted-foreground">Acme Co — shadcn/ui lab</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] text-amber-600 border-amber-200 bg-amber-50">Demo data</Badge>
            {approvals > 0 && (
              <Badge className="text-[11px] bg-blue-600 hover:bg-blue-600">{approvals} pending review</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">

        {/* Hero card */}
        <Card className="overflow-hidden">
          <div className="grid lg:grid-cols-[1.4fr_0.9fr]">
            <CardContent className="p-7">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Agents</p>
              <h2 className="text-3xl font-semibold leading-tight">Agent Command Center</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground max-w-md">
                Run focused marketing agents, review approval-required work, and open saved outputs from one workspace.
              </p>
              <div className="mt-5 flex gap-3">
                <a
                  href="#run-agent"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  <Zap size={14} /> Run an agent
                </a>
                <button className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                  <FileText size={14} /> Review approvals
                  {approvals > 0 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      {approvals}
                    </span>
                  )}
                </button>
              </div>
            </CardContent>

            <div className="border-t lg:border-l lg:border-t-0 bg-muted/40 p-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Operating snapshot</p>
              <p className="mt-1 text-xs text-muted-foreground">Acme Co · {Object.keys(AGENTS).length} agents available</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Running',   value: running,   highlight: false },
                  { label: 'Queued',    value: queued,    highlight: false },
                  { label: 'Approvals', value: approvals, highlight: approvals > 0 },
                  { label: 'Outputs',   value: outputs,   highlight: false },
                ].map(item => (
                  <Card key={item.label} className="border-0 shadow-none bg-background">
                    <CardContent className="p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                      <p className={`mt-1 text-2xl font-bold ${item.highlight ? 'text-blue-600' : ''}`}>{item.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Approval queue banner */}
        {MOCK_PENDING_APPROVALS.length > 0 ? (
          <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 cursor-pointer hover:bg-blue-100 transition-colors">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-600">
              <span className="text-sm font-bold text-white">{MOCK_PENDING_APPROVALS.length}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-900">
                {MOCK_PENDING_APPROVALS.length} outputs waiting for your review
              </p>
              <p className="mt-0.5 text-xs text-blue-700 truncate">
                {MOCK_PENDING_APPROVALS.map(a => AGENTS[a.agent as AgentId]?.name).join(', ')}
              </p>
            </div>
            <span className="flex-shrink-0 text-sm font-semibold text-blue-700 flex items-center gap-1">
              Review <ChevronRight size={14} />
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
            <span className="text-sm text-muted-foreground">Queue is clear. Nothing is waiting for review.</span>
          </div>
        )}

        {/* Run agent section */}
        <div id="run-agent">
          <RunAgentPanel />
        </div>

        {/* Activity + Scorecard */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <LiveActivity />
          <AgentScorecard />
        </div>

        {/* Recent outputs */}
        <RecentOutputs />

      </div>
    </div>
  )
}
