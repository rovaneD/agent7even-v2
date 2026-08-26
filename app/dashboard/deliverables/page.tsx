import { auth } from '@clerk/nextjs/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { loadDashboardSession } from '@/lib/profiles/getDashboardWorkspaceContext'
import DeliverablesClient from './DeliverablesClient'
import { getTeamPermissions, hasPermission } from '@/lib/teamPermissions'
import { normalizeDeliverable } from '@/lib/deliverables/projectDeliverables'

export default async function DeliverablesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()
  const { profile, workspace } = await loadDashboardSession(supabase, userId, email)

  if (!profile) redirect('/dashboard')

  const teamPerms = await getTeamPermissions(profile.id)
  if (!hasPermission(teamPerms, 'deliverables')) redirect('/dashboard')

  const dataUserId = workspace?.workspaceId ?? profile.id
  const workspaceProfile = workspace?.workspaceProfile ?? profile

  const { data: deliverables } = await supabase
    .from('deliverables')
    .select('*, projects!inner(id, title, user_id)')
    .eq('projects.user_id', dataUserId)
    .order('created_at', { ascending: false })

  return (
    <DeliverablesClient
      profileId={dataUserId}
      companyName={workspaceProfile.company_name ?? ''}
      deliverables={(deliverables ?? []).map(normalizeDeliverable)}
    />
  )
}
