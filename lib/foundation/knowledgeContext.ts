import type { SupabaseClient } from '@supabase/supabase-js'

export type FoundationKnowledgeRow = {
  id: string
  source_type: string
  source_name: string
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

export async function loadFoundationKnowledgeContext(
  supabase: SupabaseClient,
  workspaceProfileId: string,
  limit = 12,
): Promise<FoundationKnowledgeRow[]> {
  const { data, error } = await supabase
    .from('foundation_knowledge')
    .select('id, source_type, source_name, confirmed_fields, created_at')
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
      confirmed_fields: (row.confirmed_fields ?? {}) as Record<string, unknown>,
      created_at: row.created_at as string,
    }))
    .filter(row => Object.keys(row.confirmed_fields).length > 0)
}

/** Agent system prompt — reference layer, not Phase 1 identity. */
export function formatFoundationKnowledgeForAgents(rows: FoundationKnowledgeRow[]): string {
  if (rows.length === 0) return ''

  const blocks = rows
    .map(row => {
      const lines = Object.entries(row.confirmed_fields)
        .map(([key, value]) => {
          const formatted = formatConfirmedValue(value)
          if (!formatted) return null
          return `- ${humanizeFieldKey(key)}: ${formatted}`
        })
        .filter(Boolean)

      if (lines.length === 0) return null
      return `### ${row.source_name} (${row.source_type})\n${lines.join('\n')}`
    })
    .filter(Boolean)

  if (blocks.length === 0) return ''

  return `## Uploaded knowledge (reference — not Phase 1 identity)
Owner-confirmed excerpts from uploaded source materials. Use to enrich output; Phase 1 Foundation remains the anchor. Do not replace or override Foundation answers with these excerpts.

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
    return `- ${row.source_name}: ${preview}`
  })

  return `
UPLOADED KNOWLEDGE (reference only — Phase 1 Foundation is still the anchor):
${snippets.join('\n')}
Use these as enrichment when relevant; do not recite them verbatim or treat them as identity updates.`
}
