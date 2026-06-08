import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { openRouterComplete } from '@/lib/agents/openrouter'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'

export async function POST(req: Request) {
  const { profileId } = await req.json()

  if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 })

  const cronAuthorized = isAuthorizedCronRequest(req)
  const supabase = cronAuthorized ? createServiceClient() : null

  if (!cronAuthorized) {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const authedSupabase = createServiceClient()
    const { data: profile } = await authedSupabase
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    if (profile.id !== profileId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const serviceSupabase = supabase ?? createServiceClient()

  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await serviceSupabase
    .from('daily_digests')
    .select('id')
    .eq('user_id', profileId)
    .eq('date', today)
    .single()

  if (existing) return NextResponse.json({ digestId: existing.id, cached: true })

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Completed agent runs in last 24h
  const { data: agentTasks } = await serviceSupabase
    .from('agent_tasks')
    .select('id, agent, status, cost_usd, created_at')
    .eq('user_id', profileId)
    .gte('created_at', since)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(20)

  const digestAgentTasks = (agentTasks ?? [])
    .filter(task => !isSystemAgent(task.agent))
    .slice(0, 5)

  // Pending approvals
  const { data: pendingTasks } = await serviceSupabase
    .from('agent_tasks')
    .select('id, agent, created_at')
    .eq('user_id', profileId)
    .eq('requires_approval', true)
    .eq('status', 'completed')
    .is('approved_at', null)
    .is('rejected_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  // Fetch outputs separately (avoids FK dependency)
  const allTaskIds = [
    ...digestAgentTasks.map(t => t.id),
    ...(pendingTasks ?? []).map(t => t.id),
  ]
  const { data: allOutputs } = allTaskIds.length
    ? await serviceSupabase.from('agent_outputs').select('task_id, content').in('task_id', allTaskIds)
    : { data: [] }

  const outputByTask = Object.fromEntries(
    (allOutputs ?? []).map(o => [o.task_id, o.content as unknown])
  )

  // Active campaigns → today's actions
  const { data: campaigns } = await serviceSupabase
    .from('campaigns')
    .select('title, plan')
    .eq('user_id', profileId)
    .eq('status', 'active')

  const todayActions: { task: string; channel: string; campaignTitle: string; cta: string }[] = []
  campaigns?.forEach(campaign => {
    const plan = campaign.plan && typeof campaign.plan === 'object'
      ? campaign.plan as Record<string, unknown>
      : {}
    const actions = (plan.doThisToday as { task: string; channel: string }[]) ?? []
    actions.slice(0, 2).forEach(action => {
      todayActions.push({
        task:          action.task,
        channel:       action.channel ?? 'General',
        campaignTitle: campaign.title,
        cta:           'Do this with Maya →',
      })
    })
  })

  // Generate one-line Haiku summaries for each agent run
  const agentSummaries = await Promise.all(
    digestAgentTasks.map(async task => {
      const preview = getOutputPreview(outputByTask[task.id], 300)
      const agentName = formatAgentName(task.agent)

      if (!preview) {
        return { agentId: task.agent, agentName, summary: 'Completed a run with no output recorded.', outputCount: 0, needsApproval: false }
      }

      try {
        const result = await openRouterComplete({
          model: 'anthropic/claude-haiku-4-5',
          messages: [{
            role: 'user',
            content: `Write a single sentence (max 20 words) in first person as Maya summarizing what this agent found or produced. Start with "I" or the agent action.
Agent: ${agentName}
Output preview: ${preview}
Return only the sentence, nothing else.`,
          }],
          max_tokens: 60,
          temperature: 0.4,
        })
        return { agentId: task.agent, agentName, summary: result.content.trim(), outputCount: 1, needsApproval: false }
      } catch {
        return { agentId: task.agent, agentName, summary: `${agentName} completed a run.`, outputCount: 1, needsApproval: false }
      }
    })
  )

  const approvalItems = (pendingTasks ?? []).map(task => ({
    taskId:    task.id,
    agentId:   task.agent,
    agentName: formatAgentName(task.agent),
    preview:   getOutputPreview(outputByTask[task.id], 150),
    createdAt: task.created_at,
    reviewUrl: `/dashboard/agents/approvals?task=${task.id}`,
  }))

  const { data: digest, error } = await serviceSupabase
    .from('daily_digests')
    .insert({
      user_id:       profileId,
      date:          today,
      agent_runs:    agentSummaries,
      approvals:     approvalItems,
      today_actions: todayActions.slice(0, 3),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ digestId: digest.id })
}

function formatAgentName(agentId: string): string {
  const names: Record<string, string> = {
    competitor_watcher:     'Competitor Watcher',
    weekly_content:         'Weekly Content',
    campaign_builder:       'Campaign Builder',
    performance_digest:     'Performance Digest',
    trend_spotter:          'Trend Spotter',
    email_sequence_builder: 'Email Sequence Builder',
    ad_variations:          'Ad Variations',
    seo_scanner:            'SEO Scanner',
    brand_voice_guardian:   'Brand Voice Guardian',
  }
  return names[agentId] ?? agentId
}

function isSystemAgent(agentId: string): boolean {
  return agentId === 'maya' || agentId.startsWith('foundation_')
}

function getOutputPreview(content: unknown, maxLength: number): string {
  if (typeof content === 'string') return content.slice(0, maxLength)
  if (!content || typeof content !== 'object') return ''

  const raw = (content as { raw?: unknown }).raw
  if (typeof raw === 'string') return raw.slice(0, maxLength)

  return JSON.stringify(content).slice(0, maxLength)
}
