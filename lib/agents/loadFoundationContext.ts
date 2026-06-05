import { createServiceClient } from '@/lib/supabase/server'
import { computeMemoryStats, type FoundationMemoryResponse } from '@/app/api/foundation/memory/route'

export interface FoundationContext {
  // Raw Foundation answers from profiles.foundation_answers JSONB.
  // Primary source when foundation_documents haven't been generated yet.
  answers: Record<string, string>

  // Generated Foundation documents — canonical when present (per MAYA_CONTEXT).
  // Documents win over answers when both exist.
  documents: {
    brief:       string
    icp:         string
    positioning: string
    voice:       string
    plan:        string
  }

  // Competitor info from answers.competitors freetext.
  // NOT profiles.competitors — that array is null for most accounts.
  // Answers-sourced until generate is fixed; documents layer richer context on top.
  competitorsFreetext: string

  // True when answers OR documents contain any content.
  // Do NOT derive this from profiles.foundation_complete — that flag is unreliable
  // (can be true with 0 foundation_documents rows).
  hasFoundation: boolean
}

export async function loadFoundationContext(profileId: string): Promise<FoundationContext> {
  const supabase = createServiceClient()

  const [{ data: profileRow }, { data: docRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('foundation_answers')
      .eq('id', profileId)
      .single(),

    supabase
      .from('foundation_documents')
      .select('type, markdown')
      .eq('user_id', profileId),
  ])

  // Parse JSONB answers — coerce all values to strings; arrays join as CSV.
  const rawAnswers = (profileRow?.foundation_answers ?? {}) as Record<string, unknown>
  const answers: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawAnswers)) {
    if (v != null) {
      answers[k] = Array.isArray(v)
        ? (v as unknown[]).filter(Boolean).join(', ')
        : String(v).trim()
    }
  }

  // Documents are canonical — answers are the temporary fallback while generate is unfixed.
  const documents = {
    brief:       docRows?.find(d => d.type === 'brief')?.markdown       ?? '',
    icp:         docRows?.find(d => d.type === 'icp')?.markdown         ?? '',
    positioning: docRows?.find(d => d.type === 'positioning')?.markdown ?? '',
    voice:       docRows?.find(d => d.type === 'voice')?.markdown       ?? '',
    plan:        docRows?.find(d => d.type === 'plan')?.markdown        ?? '',
  }

  const competitorsFreetext = (answers.competitors ?? '').trim()

  const hasFoundation =
    Object.values(answers).some(v => v.length > 0) ||
    Object.values(documents).some(v => v.length > 0)

  return { answers, documents, competitorsFreetext, hasFoundation }
}

export async function loadFoundationMemory(profileId: string): Promise<FoundationMemoryResponse> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: outputs } = await supabase
    .from('agent_outputs')
    .select('status, created_at, agent_tasks(agent)')
    .eq('user_id', profileId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  return computeMemoryStats((outputs ?? []) as unknown as Parameters<typeof computeMemoryStats>[0])
}

export function formatMemoryForAgent(memory: FoundationMemoryResponse): string {
  if (!memory.hasData) return ''
  const lines = memory.stats.map(s => {
    const rate = s.approvalRate !== null ? ` · ${s.approvalRate}% approval` : ''
    const pending = s.pending > 0 ? ` · ${s.pending} pending` : ''
    return `- ${s.agentName}: ${s.total} run${s.total !== 1 ? 's' : ''}${rate}${pending}`
  })
  return `## Maya's Memory (last 30 days)\n${lines.join('\n')}`
}
