import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import CampaignDetail from './CampaignDetail'

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) redirect('/sign-in')

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .eq('user_id', profile.id)
    .single()

  if (!campaign) notFound()

  const plan = campaign.plan && typeof campaign.plan === 'object'
    ? campaign.plan as Record<string, unknown>
    : {}
  const legacyWeeks = Array.isArray(plan.weeks)
    ? plan.weeks.map((week, weekIndex) => {
        const weekRecord = week && typeof week === 'object' ? week as Record<string, unknown> : {}
        const tasks = Array.isArray(weekRecord.tasks) ? weekRecord.tasks : []
        return {
          week: typeof weekRecord.week === 'number' ? weekRecord.week : weekIndex + 1,
          theme: typeof weekRecord.theme === 'string' ? weekRecord.theme : `Week ${weekIndex + 1}`,
          days: tasks.map((task, taskIndex) => {
            const taskRecord = task && typeof task === 'object' ? task as Record<string, unknown> : {}
            return {
              day: typeof taskRecord.day === 'string' ? taskRecord.day : `Day ${taskIndex + 1}`,
              channel: typeof taskRecord.channel === 'string' ? taskRecord.channel : 'Organic',
              type: 'Task',
              content: typeof taskRecord.action === 'string' ? taskRecord.action : 'Planned campaign task',
              mins: 0,
            }
          }),
        }
      })
    : []

  const normalizedCampaign = {
    ...campaign,
    mode: campaign.mode ?? plan.mode ?? 'open_canvas',
    segment: campaign.segment ?? plan.segment ?? null,
    goal: campaign.goal ?? plan.goal ?? null,
    timeline_days: campaign.timeline_days ?? plan.timelineDays ?? null,
    strategy_summary: campaign.strategy_summary ?? plan.strategySummary ?? plan.summary ?? null,
    do_this_today: campaign.do_this_today ?? plan.doThisToday ?? [],
    week_plan: campaign.week_plan ?? plan.weekPlan ?? legacyWeeks,
  }

  return <CampaignDetail campaign={normalizedCampaign as any} />
}
