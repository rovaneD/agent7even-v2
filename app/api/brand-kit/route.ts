import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Fetch profile using limit(1) pattern — never .single()
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  const profile = profileRows?.[0] ?? null
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const profileId = profile.id

  // Fetch all brand kit data in parallel
  const [
    { data: sections },
    { data: colors },
    { data: fonts },
    { data: rawAssets },
    { data: documents },
  ] = await Promise.all([
    supabase
      .from('brand_kit_sections')
      .select('*')
      .eq('user_id', profileId),
    supabase
      .from('brand_kit_colors')
      .select('*')
      .eq('user_id', profileId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('brand_kit_fonts')
      .select('*')
      .eq('user_id', profileId),
    supabase
      .from('brand_kit_assets')
      .select('*')
      .eq('user_id', profileId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('foundation_documents')
      .select('*')
      .eq('user_id', profileId)
      .in('type', ['brief', 'icp', 'positioning', 'voice', 'tagline', 'elevator_pitch', 'about_us', 'mission']),
  ])

  // Generate signed URLs for assets that have a file_url
  const assets = await Promise.all(
    (rawAssets ?? []).map(async (asset) => {
      if (!asset.file_url) return asset

      // Extract storage path: everything after "brand-assets/" in the URL
      const marker = 'brand-assets/'
      const markerIndex = asset.file_url.indexOf(marker)
      if (markerIndex === -1) return asset

      const storagePath = asset.file_url.slice(markerIndex + marker.length)

      const { data: signedData, error: signedError } = await supabase.storage
        .from('brand-assets')
        .createSignedUrl(storagePath, 3600)

      if (signedError || !signedData?.signedUrl) {
        // Fall back to original URL if signing fails
        return asset
      }

      return { ...asset, signed_url: signedData.signedUrl }
    })
  )

  return NextResponse.json({
    sections: sections ?? [],
    colors: colors ?? [],
    fonts: fonts ?? [],
    assets,
    documents: documents ?? [],
  })
}
