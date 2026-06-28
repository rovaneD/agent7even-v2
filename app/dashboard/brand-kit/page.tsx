import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createBrandAssetSignedUrl } from '@/lib/brandKit/signAssetUrl'
import { createServiceClient } from '@/lib/supabase/server'
import BrandKitView from './BrandKitView'

export default async function BrandKitPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, company_name, plan')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  const profile = profileRows?.[0] ?? null
  if (!profile) redirect('/dashboard')

  // Fetch all brand kit data in parallel
  const [
    { data: sections },
    { data: colors },
    { data: fonts },
    { data: rawAssets },
    { data: documents },
  ] = await Promise.all([
    supabase.from('brand_kit_sections').select('*').eq('user_id', profile.id),
    supabase.from('brand_kit_colors').select('*').eq('user_id', profile.id).order('sort_order'),
    supabase.from('brand_kit_fonts').select('*').eq('user_id', profile.id),
    supabase.from('brand_kit_assets').select('*').eq('user_id', profile.id).order('sort_order'),
    supabase
      .from('foundation_documents')
      .select('*')
      .eq('user_id', profile.id)
      .in('type', ['brief', 'icp', 'positioning', 'voice', 'tagline', 'elevator_pitch', 'about_us', 'mission']),
  ])

  // Generate signed URLs for stored assets
  const assets = await Promise.all(
    (rawAssets ?? []).map(async (asset) => {
      if (!asset.file_url) return asset
      const signed_url = await createBrandAssetSignedUrl(supabase, asset.file_url)
      return signed_url ? { ...asset, signed_url } : asset
    }),
  )

  return (
    <BrandKitView
      profileId={profile.id}
      companyName={profile.company_name ?? ''}
      plan={profile.plan ?? null}
      initialSections={sections ?? []}
      initialColors={colors ?? []}
      initialFonts={fonts ?? []}
      initialAssets={assets}
      initialDocuments={documents ?? []}
    />
  )
}
