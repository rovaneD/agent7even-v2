import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createBrandAssetSignedUrl } from '@/lib/brandKit/signAssetUrl'
import { createServiceClient } from '@/lib/supabase/server'
import { isProfileOnStarterTrial } from '@/lib/ai/toolkitPlanLimits'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import BrandKitView from './BrandKitView'

export default async function BrandKitPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, company_name, plan, stripe_subscription_id')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  const profile = profileRows?.[0] ?? null
  if (!profile) redirect('/dashboard')

  const teamPerms = await getTeamPermissions(profile.id)
  if (!hasPermission(teamPerms, 'brand_kit')) redirect('/dashboard')

  // Product rule: Brand Kit is locked during the Starter free trial.
  if (await isProfileOnStarterTrial(profile)) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-16 sm:px-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">Brand Kit</p>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.02em] text-text-primary">
            Unlocks when your trial converts
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-text-sec">
            Brand Kit — your colors, fonts, voice guide, and brand documents — is included in the
            Starter plan but locked during the 3-day free trial. It opens automatically as soon as
            your trial converts to a paid plan.
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-text-inverse transition-colors hover:bg-[#2563EB]"
            >
              View billing
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-2"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const workspaceId = await resolveWorkspaceProfileId(supabase, profile.id)

  // Fetch all brand kit data in parallel
  const [
    { data: sections },
    { data: colors },
    { data: fonts },
    { data: rawAssets },
    { data: documents },
  ] = await Promise.all([
    supabase.from('brand_kit_sections').select('*').eq('user_id', workspaceId),
    supabase.from('brand_kit_colors').select('*').eq('user_id', workspaceId).order('sort_order'),
    supabase.from('brand_kit_fonts').select('*').eq('user_id', workspaceId),
    supabase.from('brand_kit_assets').select('*').eq('user_id', workspaceId).order('sort_order'),
    supabase
      .from('foundation_documents')
      .select('*')
      .eq('user_id', workspaceId)
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
      profileId={workspaceId}
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
