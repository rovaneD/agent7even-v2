import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { campaignId, task, selectedOption, messages } = await req.json()

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Resolve campaign — use provided id or fall back to most recent active campaign
  let resolvedId: string | null = campaignId ?? null

  if (!resolvedId) {
    const { data: recent } = await supabase
      .from('campaigns')
      .select('id')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    resolvedId = recent?.id ?? null
  }

  if (!resolvedId) {
    return NextResponse.json({ error: 'No campaign found' }, { status: 404 })
  }

  // Fetch current tasks array
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('tasks')
    .eq('id', resolvedId)
    .single()

  const existingTasks: unknown[] = Array.isArray(campaign?.tasks) ? campaign.tasks : []

  const newTask = {
    id: crypto.randomUUID(),
    task,
    status: 'completed',
    selected_option: selectedOption,
    completed_at: new Date().toISOString(),
    message_count: Array.isArray(messages) ? messages.length : 0,
  }

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({ tasks: [...existingTasks, newTask], updated_at: new Date().toISOString() })
    .eq('id', resolvedId)

  if (updateError) {
    console.error('[task-complete] update error:', updateError.message)
    return NextResponse.json({ error: 'Failed to save task' }, { status: 500 })
  }

  return NextResponse.json({ success: true, taskId: newTask.id })
}
