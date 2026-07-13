import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import {
  MARKETING_CHAT_MAX_IP_PER_HOUR,
  MARKETING_CHAT_MAX_SESSION_MESSAGES,
} from '@/lib/marketing/marketingChatConfig'

export function hashMarketingChatIp(ip: string): string {
  const pepper = process.env.MARKETING_CHAT_IP_PEPPER ?? 'agent7even-marketing-chat-v1'
  return createHash('sha256').update(`${pepper}:${ip}`).digest('hex')
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

export async function countSessionUserMessages(sessionId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('marketing_chat_logs')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('role', 'user')

  if (error) {
    console.error('[marketing/chat] session count error:', error.message)
    throw new Error('log_unavailable')
  }
  return count ?? 0
}

export async function countIpMessagesLastHour(ipHash: string): Promise<number> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('marketing_chat_logs')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('role', 'user')
    .gte('created_at', since)

  if (error) {
    console.error('[marketing/chat] ip rate count error:', error.message)
    throw new Error('log_unavailable')
  }
  return count ?? 0
}

export async function assertSessionUnderCap(sessionId: string): Promise<void> {
  const count = await countSessionUserMessages(sessionId)
  if (count >= MARKETING_CHAT_MAX_SESSION_MESSAGES) {
    throw new Error('session_limit')
  }
}

export async function assertIpUnderRateLimit(ipHash: string): Promise<void> {
  const count = await countIpMessagesLastHour(ipHash)
  if (count >= MARKETING_CHAT_MAX_IP_PER_HOUR) {
    throw new Error('rate_limit')
  }
}

export interface MarketingChatLogInsert {
  session_id: string
  role: 'user' | 'assistant'
  content: string
  ip_hash: string
  model?: string | null
  prompt_tokens?: number | null
  completion_tokens?: number | null
  cost_usd?: number | null
}

export async function insertMarketingChatLog(row: MarketingChatLogInsert): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('marketing_chat_logs').insert(row)
  if (error) {
    console.error('[marketing/chat] insert log error:', error.message)
    throw new Error('log_unavailable')
  }
}
