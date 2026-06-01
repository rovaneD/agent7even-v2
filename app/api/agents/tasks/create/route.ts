import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createTask } from '@/lib/agents/runner'
import { AgentId } from '@/lib/agents/registry'
import { logActivity } from '@/lib/activity'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const body = await req.json()
  const { agent, input = {}, priority = 'normal', scheduledFor } = body

  if (!agent) return NextResponse.json({ error: 'agent is required' }, { status: 400 })

  try {
    const task = await createTask({
      userId: profile.id,
      agent: agent as AgentId,
      input,
      triggerType: 'user',
      priority,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
    })

    // Fire the agent immediately if not scheduled.
    // On any failure, mark the task failed so it surfaces in the UI instead of hanging at pending.
    if (!scheduledFor) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const runUrl = `${baseUrl}/api/agents/run/${agent.replace(/_/g, '-')}`
      fetch(runUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, input: { ...input, userId: profile.id } }),
      }).then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => `HTTP ${res.status}`)
          console.error('Agent run failed:', runUrl, res.status, text)
          await supabase
            .from('agent_tasks')
            .update({ status: 'failed', error: `run-route error ${res.status}: ${text.slice(0, 200)}`, completed_at: new Date().toISOString() })
            .eq('id', task.id)
        }
      }).catch(async (err) => {
        console.error('Agent fire error:', err)
        await supabase
          .from('agent_tasks')
          .update({ status: 'failed', error: String(err).slice(0, 200), completed_at: new Date().toISOString() })
          .eq('id', task.id)
      })
    }

    logActivity(profile.id, 'agent_run', { agent }).catch(() => {})
    return NextResponse.json({ taskId: task.id, status: task.status })
  } catch (err) {
    console.error('Create task error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
