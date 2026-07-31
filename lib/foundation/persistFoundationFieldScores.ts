import type { SupabaseClient } from '@supabase/supabase-js'

export type FoundationFieldScoreRow = {
  user_id: string
  field_key: string
  score: number
  feedback: string | null
  updated_at: string
}

/** Keys present previously but absent from the replacement set. */
export function staleFoundationFieldKeys(
  previousKeys: string[],
  currentKeys: Iterable<string>,
): string[] {
  const current = new Set(currentKeys)
  return previousKeys.filter(key => !current.has(key))
}

/**
 * Persist a complete replacement field-score set without wipe risk:
 * upsert the new rows first, then prune only stale keys.
 */
export async function replaceFoundationFieldScores(
  supabase: SupabaseClient,
  userId: string,
  rows: FoundationFieldScoreRow[],
  previousKeys: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('foundation_field_scores')
      .upsert(rows, { onConflict: 'user_id,field_key' })

    if (upsertError) {
      return { ok: false, error: upsertError.message }
    }
  }

  const staleKeys = staleFoundationFieldKeys(
    previousKeys,
    rows.map(row => row.field_key),
  )

  if (staleKeys.length > 0) {
    const { error: pruneError } = await supabase
      .from('foundation_field_scores')
      .delete()
      .eq('user_id', userId)
      .in('field_key', staleKeys)

    if (pruneError) {
      return { ok: false, error: pruneError.message }
    }
  }

  return { ok: true }
}
