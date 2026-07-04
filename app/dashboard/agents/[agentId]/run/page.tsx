import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { isAgentRunPageId } from '@/lib/agents/guidedSetup'
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
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, company_name, website_url')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!profile) redirect('/foundation')

  return (
    <AgentRunShell agentId={rawAgentId}>
      <AgentRunClient
        agentId={rawAgentId}
        companyName={profile.company_name ?? 'Your business'}
        profileWebsiteUrl={profile.website_url ?? null}
      />
    </AgentRunShell>
  )
}
