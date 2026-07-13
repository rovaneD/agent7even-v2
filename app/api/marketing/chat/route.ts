import { NextResponse } from 'next/server'
import { openRouterComplete } from '@/lib/agents/openrouter'
import { calculateCost } from '@/lib/agents/cost'
import { marketingChatModels } from '@/lib/ai/client'
import {
  MARKETING_CHAT_MAX_HISTORY_TURNS,
  MARKETING_CHAT_MAX_INPUT_CHARS,
  MARKETING_CHAT_MAX_OUTPUT_TOKENS,
  MARKETING_CHAT_MAX_SESSION_MESSAGES,
  MARKETING_CHAT_SESSION_LIMIT_MESSAGE,
  buildMarketingChatSystemPrompt,
  isMarketingChatEnabled,
} from '@/lib/marketing/marketingChatConfig'
import {
  assertIpUnderRateLimit,
  countSessionUserMessages,
  getClientIp,
  hashMarketingChatIp,
  insertMarketingChatLog,
} from '@/lib/marketing/marketingChatLog'

export const runtime = 'nodejs'

const UNAVAILABLE = 'Maya is unavailable right now. Try again later or email support@agent7even.ai.'

type ChatTurn = { role: 'user' | 'assistant'; content: string }

type ChatRequestBody = {
  sessionId?: string
  message?: string
  history?: ChatTurn[]
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status })
}

function trimHistory(history: ChatTurn[] | undefined): ChatTurn[] {
  if (!history?.length) return []
  const sanitized = history
    .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
    .map((t) => ({ role: t.role, content: t.content.slice(0, MARKETING_CHAT_MAX_INPUT_CHARS) }))
  const maxMessages = MARKETING_CHAT_MAX_HISTORY_TURNS * 2
  return sanitized.slice(-maxMessages)
}

export async function GET() {
  return NextResponse.json({ enabled: isMarketingChatEnabled() })
}

export async function POST(req: Request) {
  if (!isMarketingChatEnabled()) {
    return jsonError(UNAVAILABLE, 503, 'disabled')
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('[marketing/chat] OPENROUTER_API_KEY missing')
    return jsonError(UNAVAILABLE, 503, 'unavailable')
  }

  let body: ChatRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid request.', 400, 'bad_request')
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!sessionId || sessionId.length > 128) {
    return jsonError('Invalid session.', 400, 'bad_request')
  }
  if (!message) {
    return jsonError('Message is required.', 400, 'bad_request')
  }
  if (message.length > MARKETING_CHAT_MAX_INPUT_CHARS) {
    return jsonError(`Message must be ${MARKETING_CHAT_MAX_INPUT_CHARS} characters or fewer.`, 400, 'message_too_long')
  }

  const ip = getClientIp(req)
  const ipHash = hashMarketingChatIp(ip)

  try {
    await assertIpUnderRateLimit(ipHash)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'unavailable'
    if (code === 'rate_limit') {
      return jsonError('Too many requests. Please try again later.', 429, 'rate_limit')
    }
    return jsonError(UNAVAILABLE, 503, 'unavailable')
  }

  let userCountBefore = 0
  try {
    userCountBefore = await countSessionUserMessages(sessionId)
  } catch {
    return jsonError(UNAVAILABLE, 503, 'unavailable')
  }

  if (userCountBefore >= MARKETING_CHAT_MAX_SESSION_MESSAGES) {
    return jsonError(MARKETING_CHAT_SESSION_LIMIT_MESSAGE, 429, 'session_limit')
  }

  try {
    await insertMarketingChatLog({
      session_id: sessionId,
      role: 'user',
      content: message,
      ip_hash: ipHash,
    })
  } catch {
    return jsonError(UNAVAILABLE, 503, 'unavailable')
  }

  const history = trimHistory(body.history)
  const steerToSignUp = userCountBefore === MARKETING_CHAT_MAX_SESSION_MESSAGES - 2
  const systemPrompt = buildMarketingChatSystemPrompt({ steerToSignUp })
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: message },
  ]

  let content = ''
  let inputTokens = 0
  let outputTokens = 0
  let modelUsed: string = marketingChatModels.primary

  try {
    const primary = await openRouterComplete({
      model: marketingChatModels.primary,
      messages,
      max_tokens: MARKETING_CHAT_MAX_OUTPUT_TOKENS,
      temperature: 0.4,
    })
    content = primary.content
    inputTokens = primary.inputTokens
    outputTokens = primary.outputTokens
    modelUsed = primary.modelUsed
  } catch (primaryErr) {
    console.error('[marketing/chat] primary model failed:', primaryErr)
    try {
      const fallback = await openRouterComplete({
        model: marketingChatModels.fallback,
        messages,
        max_tokens: MARKETING_CHAT_MAX_OUTPUT_TOKENS,
        temperature: 0.4,
      })
      content = fallback.content
      inputTokens = fallback.inputTokens
      outputTokens = fallback.outputTokens
      modelUsed = fallback.modelUsed
    } catch (fallbackErr) {
      console.error('[marketing/chat] fallback model failed:', fallbackErr)
      return jsonError(UNAVAILABLE, 503, 'unavailable')
    }
  }

  const reply = content.trim() || UNAVAILABLE
  let costUsd = 0
  try {
    costUsd = await calculateCost(modelUsed, inputTokens, outputTokens)
  } catch (costErr) {
    console.error('[marketing/chat] cost calc failed:', costErr)
  }

  try {
    await insertMarketingChatLog({
      session_id: sessionId,
      role: 'assistant',
      content: reply,
      ip_hash: ipHash,
      model: modelUsed,
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      cost_usd: costUsd,
    })
  } catch {
    // Reply already generated — still return it to the visitor.
    console.error('[marketing/chat] failed to log assistant message')
  }

  return NextResponse.json({ reply })
}
