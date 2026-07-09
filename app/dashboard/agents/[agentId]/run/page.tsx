import { auth } from '@clerk/nextjs/server'
import { getClerkSessionEmail } from '@/lib/clerk/sessionUser'
import { notFound, redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { isAgentRunPageId } from '@/lib/agents/guidedSetup'
import { loadDashboardSession } from '@/lib/profiles/getDashboardWorkspaceContext'
import AgentRunShell from '@/components/agents/AgentRunShell'
import AgentRunClient from '@/components/agents/AgentRunClient'

export default async function AgentRunPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId: rawAgentId } = await params

  if (rawAgentId === 'content_posting') {
    redirect('/dashboard/agents/content-posting')
  }

  if (!isAgentRunPageId(rawAgentId)) {
    notFound()
  }

  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const email = await getClerkSessionEmail()
  const { profile, workspace } = await loadDashboardSession(supabase, userId, email)
  if (!profile) redirect('/foundation')

  const workspaceProfile = workspace?.workspaceProfile ?? profile

  return (
    <AgentRunShell agentId={rawAgentId}>
      <AgentRunClient
        agentId={rawAgentId}
        companyName={workspaceProfile.company_name ?? 'Your business'}
        profileWebsiteUrl={workspaceProfile.website_url ?? null}
        isTeamMember={workspace?.isTeamMember ?? false}
      />
    </AgentRunShell>
  )
}
