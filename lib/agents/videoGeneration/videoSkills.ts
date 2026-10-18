import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Video skills: each one is a small production recipe (writer direction + model + length + credit tier),
 * stored as data in `video_skills` like image `post_styles`. New skill = new row; a skill that needs a
 * new pipeline step (references, multi-shot, overlays) adds that step in code once, then reuses it.
 */
export type VideoSkill = {
  id: string
  name: string
  tagline: string
  recipe: string
  /** OpenRouter video model id */
  model: string
  fallback_model: string | null
  duration_seconds: number
  /** 'video_standard' | 'video_premium' — which credit price this skill charges */
  credit_action: 'video_standard' | 'video_premium'
  example_paths: string[]
  sort_order: number
}

/** Built-in copy of the launch skill so the feature works before migration 48 runs. */
export const BUILTIN_VIDEO_SKILLS: VideoSkill[] = [
  {
    id: 'creative_concept',
    name: 'Creative concept',
    tagline: 'A short visual idea that makes the point — miniature worlds, paper craft, editorial portraits, witty objects',
    recipe: [
      'Pick the ONE look that carries this idea best:',
      '- Surreal miniature: a tilt-shift model world (main street, shop counter, street corner) with figurine people and one real everyday object at giant scale; soft studio light, pastel two-color palette, slow crane or push-in.',
      '- Paper craft stop-motion: cut-paper or cardboard pieces that fold, pop up and slide into place at 12 fps on a real surface (marble, kraft, wood); visible paper grain and cut edges, tight palette, handmade charm.',
      '- Editorial portrait: a real owner type from this customer base in their own workplace against a saturated painted wall, hard on-camera flash pops, quick punch-in zooms that freeze on each pop, ends on a proud expression.',
      '- Witty object: a locked-off close shot of the real materials of the trade (flowers, ingredients, tools, fabric, parts) that move by themselves from mess into the finished product or result; real textures, natural workplace light.',
      'The motion itself is the punchline: something builds, transforms, clears, fills up or reveals. Real materials and textures, crisp detail, one tight palette.',
    ].join('\n'),
    model: 'kwaivgi/kling-v3.0-pro',
    fallback_model: 'bytedance/seedance-2.5',
    duration_seconds: 5,
    credit_action: 'video_standard',
    example_paths: [],
    sort_order: 10,
  },
]

let cache: { at: number; skills: VideoSkill[] } | null = null

export async function loadVideoSkills(supabase: SupabaseClient): Promise<VideoSkill[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.skills
  try {
    const { data, error } = await supabase
      .from('video_skills')
      .select('id,name,tagline,recipe,model,fallback_model,duration_seconds,credit_action,example_paths,sort_order')
      .eq('enabled', true)
      .order('sort_order')
    if (error || !data?.length) throw error ?? new Error('no rows')
    const skills = data.map(r => ({
      ...r,
      example_paths: (r.example_paths as string[] | null) ?? [],
      credit_action: r.credit_action === 'video_premium' ? 'video_premium' : 'video_standard',
    })) as VideoSkill[]
    cache = { at: Date.now(), skills }
    return skills
  } catch {
    return BUILTIN_VIDEO_SKILLS
  }
}

export async function resolveVideoSkill(supabase: SupabaseClient, id: string | null | undefined): Promise<VideoSkill> {
  const skills = await loadVideoSkills(supabase)
  return skills.find(s => s.id === id) ?? skills[0] ?? BUILTIN_VIDEO_SKILLS[0]!
}
