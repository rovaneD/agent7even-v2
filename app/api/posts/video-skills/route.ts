import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { loadVideoSkills } from '@/lib/agents/videoGeneration/videoSkills'
import { ACTION_CREDIT_COST } from '@/lib/credits/actionCosts'
import { createPostAssetSignedUrl } from '@/lib/postAssets'

/** Enabled video skills for the picker, with credit price and 1h signed example clips. */
export async function GET() {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const skills = await loadVideoSkills(supabase)
  const out = await Promise.all(skills.map(async s => ({
    id: s.id,
    name: s.name,
    tagline: s.tagline,
    credits: ACTION_CREDIT_COST[s.credit_action],
    premium: s.credit_action === 'video_premium',
    seconds: s.duration_seconds,
    examples: (await Promise.all(s.example_paths.slice(0, 4).map(p => createPostAssetSignedUrl(p, 60 * 60)))).filter(Boolean),
  })))
  return NextResponse.json({ skills: out })
}
