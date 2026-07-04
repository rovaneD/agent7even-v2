import { auth, currentUser } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { isAgentRunPageId } from '@/lib/agents/guidedSetup'
import { getDashboardProfileForClerkUser } from '@/lib/profiles/getDashboardProfile'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'
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
  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const profile = await getDashboardProfileForClerkUser(supabase, userId, email)

  if (!profile) redirect('/foundation')
  const workspaceId = await resolveWorkspaceProfileId(supabase, profile.id)
  const { data: workspaceProfile } = await supabase
    .from('profiles')
    .select('company_name, website_url')
    .eq('id', workspaceId)
    .single()

  return (
    <AgentRunShell agentId={rawAgentId}>
      <AgentRunClient
        agentId={rawAgentId}
        companyName={workspaceProfile?.company_name ?? profile.company_name ?? 'Your business'}
        profileWebsiteUrl={workspaceProfile?.website_url ?? profile.website_url ?? null}
      />
    </AgentRunShell>
  )
}
