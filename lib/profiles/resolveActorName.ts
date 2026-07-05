import type { SupabaseClient } from '@supabase/supabase-js'

export function formatProfileDisplayName(profile: {
  full_name?: string | null
  email?: string | null
} | null | undefined): string {
  if (!profile) return 'Team member'
  return profile.full_name?.trim() || profile.email?.trim() || 'Team member'
}

export async function resolveProfileDisplayNames(
  supabase: SupabaseClient,
  profileIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(profileIds.filter(Boolean))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', unique)

  for (const row of data ?? []) {
    map.set(row.id, formatProfileDisplayName(row))
  }
  return map
}
