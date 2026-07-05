import { createServiceClient } from '@/lib/supabase/server'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'

export type FoundationLayerEntry = {
  title: string
  body: string
  state: 'consistent' | 'extending'
  theme: string | null
  approvedAt: string
}

export async function loadFoundationLayers(
  actorProfileId: string,
  limit = 8,
): Promise<FoundationLayerEntry[]> {
  const supabase = createServiceClient()
  const profileId = await resolveWorkspaceProfileId(supabase, actorProfileId)

  const { data, error } = await supabase
    .from('foundation_layers')
    .select('title, body, state, theme, approved_at')
    .eq('profile_id', profileId)
    .order('approved_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 20))

  if (error) {
    if (error.message.includes('foundation_layers')) return []
    console.error('[foundation-layers] load failed:', error.message)
    return []
  }

  return (data ?? []).map(row => ({
    title: row.title,
    body: row.body,
    state: row.state as FoundationLayerEntry['state'],
    theme: row.theme,
    approvedAt: row.approved_at,
  }))
}

export function formatFoundationLayersForAgents(layers: FoundationLayerEntry[]): string {
  if (!layers.length) return ''

  const lines = layers.map(layer => {
    const label = layer.state === 'extending' ? 'Extension' : 'Reinforcement'
    return `- **${label}: ${layer.title}** — ${layer.body}`
  })

  return [
    '## Foundation evolution (user-approved layers)',
    'These sit alongside Phase 1. They do not replace guarded Foundation identity.',
    ...lines,
  ].join('\n')
}
