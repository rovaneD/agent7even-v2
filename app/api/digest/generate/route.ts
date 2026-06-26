import { NextResponse } from 'next/server'
import { agentOutputContentText } from '@/lib/agents/agentOutputText'
import { agentDisplayName, formatDigestPreview } from '@/lib/agents/digestPreview'
import { createServiceClient } from '@/lib/supabase/server'
import { openRouterComplete } from '@/lib/agents/openrouter'

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const { profileId } = await req.json()

  if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await supabase
    .from('daily_digests')
    .select('id')
    .eq('user_id', profileId)
    .eq('date', today)
    .single()

  if (existing) return NextResponse.json({ digestId: existing.id, cached: true })

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Completed agent runs in last 24h
  const { data: agentTasks } = await supabase
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

  // Pending approvals — tasks complete but awaiting user sign-off
  const { data: pendingTasks } = await supabase
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
    ? await supabase.from('agent_outputs').select('task_id, content').in('task_id', allTaskIds)
    : { data: [] }

  const outputByTask = Object.fromEntries(
    (allOutputs ?? []).map(o => [o.task_id, agentOutputContentText(o.content)])
  )

  // Active campaigns → today's actions
  const { data: campaigns } = await supabase
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
      const preview = (outputByTask[task.id] ?? '').slice(0, 300)
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

  const approvalItems = (pendingTasks ?? []).map(task => {
    const raw = outputByTask[task.id] ?? ''
    const { title, subtitle } = formatDigestPreview(raw, task.agent)
    return {
      taskId:    task.id,
      agentId:   task.agent,
      agentName: agentDisplayName(task.agent),
      title,
      subtitle,
      preview:   subtitle,
      createdAt: task.created_at,
      reviewUrl: `/dashboard/agents/approvals?task=${task.id}`,
    }
  })

  const { data: digest, error } = await supabase
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
  content_posting:        'Content Posting',
  weekly_content:         'Weekly Content',
  post_caption:           'Post Caption',
    campaign_builder:       'Campaign Builder',
    performance_digest:     'Performance Digest',
    trend_spotter:          'Trend Spotter',
    email_sequence_builder: 'Email Sequence Builder',
    idea_analysis:          'Idea Analysis',
    ad_variations:          'Ad Variations',
    seo_scanner:            'SEO Scanner',
    brand_voice_guardian:   'Brand Voice Guardian',
  }
  return names[agentId] ?? agentId
}

function isSystemAgent(agentId: string): boolean {
  return agentId === 'maya' || agentId.startsWith('foundation_')
}
