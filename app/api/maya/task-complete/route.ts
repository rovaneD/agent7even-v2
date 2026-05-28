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

  // Fetch campaign in one query — either the specific one or the most recent active
  let campaign: { id: string; tasks: unknown[] | null } | null = null

  if (campaignId) {
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, tasks')
      .eq('id', campaignId)
      .single()
    if (error) console.error('task-complete: campaignId lookup error:', error.message)
    campaign = data
  } else {
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, tasks')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (error) console.error('task-complete: recent campaign lookup error:', error.message)
    campaign = data
  }

  console.log('campaign found:', campaign?.id)

  if (!campaign) {
    return NextResponse.json({ error: 'No campaign found' }, { status: 404 })
  }

  const currentTasks: unknown[] = Array.isArray(campaign.tasks) ? campaign.tasks : []
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
    .eq('id', campaign.id)

  if (updateError) {
    console.error('[task-complete] update error:', updateError.message)
    return NextResponse.json({ error: 'Failed to save task' }, { status: 500 })
  }

  console.log('task-complete success, taskId:', newTask.id)

  return NextResponse.json({ success: true, taskId: newTask.id })
}
