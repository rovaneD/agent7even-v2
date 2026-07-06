import type { SupabaseClient } from '@supabase/supabase-js'
import { PROPOSAL_REJECT_COOLDOWN_DAYS } from '@/lib/foundation/guardian/guardianConfig'

export type ProposalThemePolicy = {
  approvedThemes: Set<string>
  rejectedThemesInCooldown: Set<string>
}

export type ThemeBlockReason = 'approved_layer' | 'reject_cooldown'

function normalizeTheme(theme: string | null | undefined): string | null {
  const trimmed = theme?.trim()
  return trimmed ? trimmed : null
}

export function themeBlockReason(
  theme: string | null | undefined,
  policy: ProposalThemePolicy,
): ThemeBlockReason | null {
  const normalized = normalizeTheme(theme)
  if (!normalized) return null
  if (policy.approvedThemes.has(normalized)) return 'approved_layer'
  if (policy.rejectedThemesInCooldown.has(normalized)) return 'reject_cooldown'
  return null
}

export function shouldBlockProposalTheme(
  theme: string | null | undefined,
  policy: ProposalThemePolicy,
): boolean {
  return themeBlockReason(theme, policy) !== null
}

function cooldownSinceIso(): string {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - PROPOSAL_REJECT_COOLDOWN_DAYS)
  return since.toISOString()
}

export async function loadProposalThemePolicy(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ProposalThemePolicy> {
  const cooldownSince = cooldownSinceIso()

  const [layersResult, rejectedResult] = await Promise.all([
    supabase.from('foundation_layers').select('theme').eq('profile_id', profileId),
    supabase
      .from('foundation_proposals')
      .select('theme')
      .eq('profile_id', profileId)
      .eq('user_decision', 'rejected')
      .gte('decided_at', cooldownSince),
  ])

  if (layersResult.error && !layersResult.error.message.includes('foundation_layers')) {
    throw new Error(layersResult.error.message)
  }

  if (rejectedResult.error && !rejectedResult.error.message.includes('user_decision')) {
    throw new Error(rejectedResult.error.message)
  }

  const approvedThemes = new Set<string>()
  for (const row of layersResult.data ?? []) {
    const theme = normalizeTheme(row.theme)
    if (theme) approvedThemes.add(theme)
  }

  const rejectedThemesInCooldown = new Set<string>()
  for (const row of rejectedResult.data ?? []) {
    const theme = normalizeTheme(row.theme)
    if (theme) rejectedThemesInCooldown.add(theme)
  }

  return { approvedThemes, rejectedThemesInCooldown }
}
