import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { campaignId, task, selectedOption, messages } = await req.json()

  console.log('task-complete called, campaignId:', campaignId)

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Resolve target campaign ID — use provided ID directly, fall back to most recent
  let targetCampaignId: string | null = campaignId ?? null

  if (!targetCampaignId) {
    console.log('task-complete: no campaignId provided, looking up most recent')
    const { data: recent, error } = await supabase
      .from('campaigns')
      .select('id')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (error) console.error('task-complete: recent campaign lookup error:', error.message)
    targetCampaignId = recent?.id ?? null
  }

  if (!targetCampaignId) {
    return NextResponse.json({ error: 'No campaign found' }, { status: 404 })
  }

  console.log('task-complete: targeting campaign:', targetCampaignId)

  const { data: campaignData } = await supabase
    .from('campaigns')
    .select('tasks')
    .eq('id', targetCampaignId)
    .single()

  const currentTasks: unknown[] = Array.isArray(campaignData?.tasks) ? campaignData.tasks : []
  console.log('current tasks:', currentTasks.length)

  const newTask = {
    id: crypto.randomUUID(),
    task,
    status: 'completed',
    selected_option: selectedOption,
    completed_at: new Date().toISOString(),
    message_count: Array.isArray(messages) ? messages.length : 0,
  }

  console.log('saving new task:', newTask)

  const newTasks = [...currentTasks, newTask]

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({ tasks: newTasks, updated_at: new Date().toISOString() })
    .eq('id', targetCampaignId)

  if (updateError) {
    console.error('[task-complete] update error:', updateError.message)
    return NextResponse.json({ error: 'Failed to save task' }, { status: 500 })
  }

  console.log('task-complete success, taskId:', newTask.id)

  return NextResponse.json({ success: true, taskId: newTask.id })
}
