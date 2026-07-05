import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { loadDashboardSession } from '@/lib/profiles/getDashboardWorkspaceContext'

export interface ContentPostingPageData {
  profileId: string
  companyName: string
  brandKitAvailable: boolean
  hasUploadedLogo: boolean
  activeTasks: Array<{
    id: string
    agent: string
    status: string
    input: Record<string, unknown>
  }>
}

export async function loadContentPostingPageData(): Promise<ContentPostingPageData> {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const { profile, workspace } = await loadDashboardSession(supabase, userId, email)

  if (!profile) redirect('/foundation')

  const workspaceProfile = workspace?.workspaceProfile ?? profile
  const dataUserId = workspace?.workspaceId ?? profile.id

  const [
    { count: colorCount },
    { count: fontCount },
    { count: logoCount },
    { count: styleRefCount },
    { data: imageryStyleDoc },
    { data: activeTasks },
  ] = await Promise.all([
    supabase.from('brand_kit_colors').select('id', { count: 'exact', head: true }).eq('user_id', dataUserId),
    supabase.from('brand_kit_fonts').select('id', { count: 'exact', head: true }).eq('user_id', dataUserId),
    supabase
      .from('brand_kit_assets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', dataUserId)
      .in('asset_type', ['logo_primary', 'logo_alternate', 'logo_icon']),
    supabase
      .from('brand_kit_assets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', dataUserId)
      .eq('asset_type', 'style_reference'),
    supabase
      .from('foundation_documents')
      .select('markdown')
      .eq('user_id', dataUserId)
      .eq('type', 'imagery_style')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('agent_tasks')
      .select('id, agent, status, input')
      .eq('user_id', dataUserId)
      .in('status', ['running', 'pending'])
      .order('created_at', { ascending: false }),
  ])

  const brandKitAvailable =
    (colorCount ?? 0) > 0
    || (fontCount ?? 0) > 0
    || (styleRefCount ?? 0) > 0
    || !!(imageryStyleDoc?.markdown?.trim())

  return {
    profileId: dataUserId,
    companyName: workspaceProfile.company_name ?? 'Your business',
    brandKitAvailable,
    hasUploadedLogo: (logoCount ?? 0) > 0,
    activeTasks: (activeTasks ?? []) as ContentPostingPageData['activeTasks'],
  }
}
