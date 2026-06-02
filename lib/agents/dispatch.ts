import { createServiceClient } from '@/lib/supabase/server'

export async function dispatchAgentTask(opts: {
  taskId: string
  agent: string
  input: Record<string, unknown>
  userId: string
}) {
  const supabase = createServiceClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const runUrl = `${baseUrl}/api/agents/run/${opts.agent.replace(/_/g, '-')}`

  try {
    const res = await fetch(runUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.INTERNAL_JOB_SECRET
          ? { 'x-internal-secret': process.env.INTERNAL_JOB_SECRET }
          : {}),
      },
      body: JSON.stringify({
        taskId: opts.taskId,
        input: { ...opts.input, userId: opts.userId },
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`)
      console.error('Agent run failed:', runUrl, res.status, text)
      await supabase
        .from('agent_tasks')
        .update({
          status: 'failed',
          error: `run-route error ${res.status}: ${text.slice(0, 200)}`,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', opts.taskId)
    }
  } catch (err) {
    console.error('Agent fire error:', err)
    await supabase
      .from('agent_tasks')
      .update({
        status: 'failed',
        error: String(err).slice(0, 200),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.taskId)
  }
}
