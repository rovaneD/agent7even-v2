import { after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadFoundationContext } from '@/lib/agents/loadFoundationContext'
import { loadFieldScores } from '@/lib/foundation/sectionStrength'
import { computeCreativeDirectionSourceHash } from './sourceHash'
import { CreativeDirectionSchema, type CreativeDirection } from './types'

async function loadCachedCreativeDirectionRow(profileId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'creative_direction, creative_direction_computed_at, creative_direction_source_hash, company_name',
    )
    .eq('id', profileId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

function parseCachedCreativeDirection(raw: unknown): CreativeDirection | null {
  const parsed = CreativeDirectionSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

async function computeCurrentSourceHash(
  profileId: string,
  answersOverride?: Record<string, unknown>,
): Promise<string> {
  const ctx = await loadFoundationContext(profileId)
  const answers: Record<string, unknown> = { ...ctx.answers }
  if (answersOverride) {
    for (const [key, value] of Object.entries(answersOverride)) {
      answers[key] = value
    }
  }
  return computeCreativeDirectionSourceHash({
    answers,
    documents: ctx.documents,
  })
}

/** Recompute, persist, return — on failure returns null and leaves prior cache intact. */
async function persistCreativeDirectionRecompute(
  profileId: string,
  companyName: string,
): Promise<CreativeDirection | null> {
  try {
    const ctx = await loadFoundationContext(profileId)
    if (!ctx.hasFoundation) {
      console.error('[creative-direction-cache] skip recompute — no Foundation', profileId)
      return null
    }

    await loadFieldScores(profileId)
    const { translateFoundationToCreativeDirection } = await import('./index')
    const direction = await translateFoundationToCreativeDirection({
      profileId,
      companyName,
    })
    const sourceHash = computeCreativeDirectionSourceHash({
      answers: ctx.answers,
      documents: ctx.documents,
    })

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        creative_direction: direction,
        creative_direction_computed_at: new Date().toISOString(),
        creative_direction_source_hash: sourceHash,
      })
      .eq('id', profileId)

    if (error) {
      console.error('[creative-direction-cache] persist failed:', error.message)
      return null
    }

    return direction
  } catch (err) {
    console.error('[creative-direction-cache] recompute failed:', err)
    return null
  }
}

/**
 * Read cached Creative Direction for generation. Lazy backfill when missing.
 * Never clears an existing cache on failure.
 */
export async function getOrComputeCreativeDirection(opts: {
  profileId: string
  companyName: string
}): Promise<CreativeDirection> {
  const row = await loadCachedCreativeDirectionRow(opts.profileId)
  const cached = parseCachedCreativeDirection(row?.creative_direction)
  if (cached) return cached

  const computed = await persistCreativeDirectionRecompute(
    opts.profileId,
    opts.companyName || row?.company_name || 'Business',
  )
  if (computed) return computed

  throw new Error('Creative direction unavailable — add Foundation content and try again')
}

/** Content-checked refresh — skips LLM when source hash unchanged and cache valid. */
export async function refreshCreativeDirectionCacheIfNeeded(
  profileId: string,
  companyName: string,
): Promise<void> {
  const row = await loadCachedCreativeDirectionRow(profileId)
  const currentHash = await computeCurrentSourceHash(profileId)
  const cached = parseCachedCreativeDirection(row?.creative_direction)

  if (row?.creative_direction_source_hash === currentHash && cached) {
    return
  }

  await persistCreativeDirectionRecompute(
    profileId,
    companyName || row?.company_name || 'Business',
  )
}

/** Non-blocking recompute after Foundation identity/document writes. */
export function scheduleCreativeDirectionCacheRefresh(
  profileId: string,
  companyName: string,
): void {
  after(async () => {
    try {
      await refreshCreativeDirectionCacheIfNeeded(profileId, companyName)
    } catch (err) {
      console.error('[creative-direction-cache] background refresh failed:', err)
    }
  })
}
