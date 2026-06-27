import { createServiceClient } from '@/lib/supabase/server'

/** Soft ceiling — warn only, never block text/chat (A3 §6). */
export const TEXT_FAIR_USE_HOURLY_CAP = 120
const WINDOW_MS = 60 * 60 * 1000

export type TextFairUseResult = {
  count: number
  cap: number
  warn: boolean
  message?: string
}

/** Count text-class agent runs in the rolling hour (Maya chat + completed text agents). */
export async function assessTextFairUse(profileId: string): Promise<TextFairUseResult> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const supabase = createServiceClient()

  const [{ count: mayaCount }, { count: agentCount }] = await Promise.all([
    supabase
      .from('agent_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profileId)
      .eq('agent', 'maya')
      .gte('created_at', since),
    supabase
      .from('agent_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profileId)
      .neq('agent', 'maya')
      .gte('created_at', since),
  ])

  const count = (mayaCount ?? 0) + (agentCount ?? 0)
  const warn = count >= TEXT_FAIR_USE_HOURLY_CAP

  return {
    count,
    cap: TEXT_FAIR_USE_HOURLY_CAP,
    warn,
    message: warn
      ? `High text usage (${count} runs in the last hour). Text stays free — contact support if this looks wrong.`
      : undefined,
  }
}
