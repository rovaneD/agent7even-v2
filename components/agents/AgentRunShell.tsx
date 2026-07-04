'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AGENTS, AGENT_COLORS, type AgentId } from '@/lib/agents/registry'
import AgentIcon from '@/components/agents/AgentIcon'
import { AGENT_GUIDED_CONFIG } from '@/lib/agents/guidedSetup'

interface AgentRunShellProps {
  agentId: AgentId
  children: ReactNode
}

export default function AgentRunShell({ agentId, children }: AgentRunShellProps) {
  const agent = AGENTS[agentId]
  const config = AGENT_GUIDED_CONFIG[agentId]
  const colors = AGENT_COLORS[agentId]

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 sm:px-8">
      <Link
        href="/dashboard/agents"
        className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-sec transition-colors hover:text-text-primary"
      >
        <ArrowLeft size={15} strokeWidth={2} />
        Back to Agents
      </Link>

      <div className="mb-8 flex items-start gap-4">
        <span
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: colors?.bg ?? '#F3F4F6', color: colors?.fg ?? '#6B7280' }}
        >
          <AgentIcon agentId={agentId} size={24} />
        </span>
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#F5349B]">Run agent</p>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.025em] text-text-primary">
            {agent.name}
          </h1>
          <p className="mt-2.5 max-w-[560px] text-[15.5px] leading-relaxed text-text-sec">
            {config.intro}
          </p>
          <p className="mt-2 text-xs text-text-muted">
            {agent.autonomyLevel === 'autonomous' ? 'Runs automatically' : 'Output goes to your approval queue'}
          </p>
        </div>
      </div>

      {children}
    </div>
  )
}
