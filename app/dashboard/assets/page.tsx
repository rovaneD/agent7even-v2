import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listCreativeAssets, listCreativeAssetFolders } from '@/lib/creativeAssets'
import { createServiceClient } from '@/lib/supabase/server'
import { loadDashboardSession } from '@/lib/profiles/getDashboardWorkspaceContext'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import AssetsClient from './AssetsClient'

export default async function AssetsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const { profile, workspace } = await loadDashboardSession(supabase, userId, email)

  if (!profile) redirect('/dashboard')

  const teamPerms = await getTeamPermissions(profile.id)
  if (!hasPermission(teamPerms, 'analytics')) redirect('/dashboard')

  const dataUserId = workspace?.workspaceId ?? profile.id
  const workspaceProfile = workspace?.workspaceProfile ?? profile

  const [assets, folders] = await Promise.all([
    listCreativeAssets(dataUserId),
    listCreativeAssetFolders(dataUserId),
  ])

  return (
    <AssetsClient
      companyName={workspaceProfile.company_name ?? ''}
      initialAssets={assets}
      initialFolders={folders}
    />
  )
}
