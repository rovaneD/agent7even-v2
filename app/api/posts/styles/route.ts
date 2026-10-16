import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolvePostsWorkspace } from '@/lib/profiles/resolvePostsWorkspace'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { loadPostStyles } from '@/lib/agents/imageGeneration/postStyles'

/** Style gallery for the image post picker: enabled styles + signed example image URLs. */
export async function GET() {
  const supabase = createServiceClient()
  const ws = await resolvePostsWorkspace(supabase)
  if (!ws) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const styles = await loadPostStyles()
    const withExamples = await Promise.all(
      styles.map(async st => ({
        id: st.id,
        name: st.name,
        tagline: st.tagline,
        usesLogo: st.uses_logo,
        examples: (
          await Promise.all(st.example_paths.slice(0, 3).map(p => createPostAssetSignedUrl(p, 60 * 60)))
        ).filter((u): u is string => Boolean(u)),
      })),
    )
    return NextResponse.json({ styles: withExamples })
  } catch (err) {
    console.error('[posts/styles]', err instanceof Error ? err.message : err)
    return NextResponse.json({ styles: [] })
  }
}
