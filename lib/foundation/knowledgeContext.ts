import type { SupabaseClient } from '@supabase/supabase-js'
import type { KnowledgeSourcePurpose } from '@/lib/foundation/knowledgePurpose'
import {
  KNOWLEDGE_PURPOSE_AGENT_NOTE,
  KNOWLEDGE_PURPOSE_LABELS,
} from '@/lib/foundation/knowledgePurpose'

export type FoundationKnowledgeRow = {
  id: string
  source_type: string
  source_name: string
  source_purpose: KnowledgeSourcePurpose | null
  purpose_confidence: string | null
  purpose_reason: string | null
  confirmed_fields: Record<string, unknown>
  created_at: string
}

function humanizeFieldKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, c => c.toUpperCase())
}

function formatConfirmedValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ')
  if (value == null) return ''
  return String(value).trim()
}

function purposeLabel(purpose: KnowledgeSourcePurpose | null): string {
  if (!purpose) return KNOWLEDGE_PURPOSE_LABELS.unknown
  return KNOWLEDGE_PURPOSE_LABELS[purpose]
}

function purposeAgentNote(purpose: KnowledgeSourcePurpose | null): string {
  if (!purpose) return KNOWLEDGE_PURPOSE_AGENT_NOTE.unknown
  return KNOWLEDGE_PURPOSE_AGENT_NOTE[purpose]
}

export async function loadFoundationKnowledgeContext(
  supabase: SupabaseClient,
  workspaceProfileId: string,
  limit = 12,
): Promise<FoundationKnowledgeRow[]> {
  const { data, error } = await supabase
    .from('foundation_knowledge')
    .select('id, source_type, source_name, source_purpose, purpose_confidence, purpose_reason, confirmed_fields, created_at')
    .eq('profile_id', workspaceProfileId)
    .not('confirmed_fields', 'is', null)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 20))

  if (error) {
    if (error.message.includes('foundation_knowledge')) return []
    throw new Error(error.message)
  }

  return (data ?? [])
    .map(row => ({
      id: row.id as string,
      source_type: row.source_type as string,
      source_name: row.source_name as string,
      source_purpose: (row.source_purpose as KnowledgeSourcePurpose | null) ?? null,
      purpose_confidence: (row.purpose_confidence as string | null) ?? null,
      purpose_reason: (row.purpose_reason as string | null) ?? null,
      confirmed_fields: (row.confirmed_fields ?? {}) as Record<string, unknown>,
      created_at: row.created_at as string,
    }))
    .filter(row => Object.keys(row.confirmed_fields).length > 0)
}

function formatKnowledgeBlock(row: FoundationKnowledgeRow): string | null {
  const lines = Object.entries(row.confirmed_fields)
    .map(([key, value]) => {
      const formatted = formatConfirmedValue(value)
      if (!formatted) return null
      return `- ${humanizeFieldKey(key)}: ${formatted}`
    })
    .filter(Boolean)

  if (lines.length === 0) return null

  const purpose = row.source_purpose ?? 'unknown'
  return `### ${row.source_name} (${row.source_type})
Classification: ${purposeLabel(purpose)} — ${purposeAgentNote(purpose)}
${lines.join('\n')}`
}

/** Agent system prompt — reference layer, not Phase 1 identity. */
export function formatFoundationKnowledgeForAgents(rows: FoundationKnowledgeRow[]): string {
  if (rows.length === 0) return ''

  const blocks = rows.map(formatKnowledgeBlock).filter(Boolean)
  if (blocks.length === 0) return ''

  const hasCompetitor = rows.some(row => row.source_purpose === 'competitor')

  return `## Uploaded knowledge (reference — not Phase 1 identity)
Owner-confirmed excerpts from uploaded source materials. Each block is tagged by purpose.
Phase 1 Foundation remains the anchor — never replace identity, voice, or positioning with competitor or market reference text.
${hasCompetitor ? '\n⚠ This workspace includes COMPETITOR REFERENCE material. Describe competitors analytically; never adopt their positioning as the client\'s own.' : ''}

${blocks.join('\n\n')}`
}

/** Maya chat — shorter reference block. */
export function formatFoundationKnowledgeForMaya(rows: FoundationKnowledgeRow[]): string {
  if (rows.length === 0) return ''

  const snippets = rows.slice(0, 6).map(row => {
    const preview = Object.entries(row.confirmed_fields)
      .slice(0, 3)
      .map(([key, value]) => `${humanizeFieldKey(key)}: ${formatConfirmedValue(value).slice(0, 120)}`)
      .join('; ')
    const tag = purposeLabel(row.source_purpose)
    return `- [${tag}] ${row.source_name}: ${preview}`
  })

  return `
UPLOADED KNOWLEDGE (reference only — Phase 1 Foundation is still the anchor):
${snippets.join('\n')}
Purpose tags show whether material is the client's business, a competitor, market context, or customer voice.
Never encourage saving competitor positioning as the client's identity.`
}
