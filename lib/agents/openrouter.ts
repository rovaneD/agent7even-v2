// lib/agents/openrouter.ts
// ─────────────────────────────────────────────
// OpenRouter API client for agent execution
// Replaces direct Anthropic SDK calls in agent routes
// ─────────────────────────────────────────────

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1'

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenRouterRequest {
  model: string
  messages: OpenRouterMessage[]
  max_tokens?: number
  temperature?: number
  stream?: boolean
}

export interface OpenRouterUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface OpenRouterResponse {
  id: string
  model: string                // actual model used (may differ if fallback triggered)
  choices: Array<{
    message: { role: string; content: string }
    finish_reason: string
  }>
  usage: OpenRouterUsage
}

// ── Standard completion (non-streaming) ───────

export async function openRouterComplete(
  req: OpenRouterRequest
): Promise<{ content: string; inputTokens: number; outputTokens: number; modelUsed: string }> {
  const res = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      // OpenRouter attribution headers — helps with rate limits + analytics
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com',
      'X-Title':      'Agent7even',
    },
    body: JSON.stringify({
      model:      req.model,
      messages:   req.messages,
      max_tokens: req.max_tokens ?? 2000,
      temperature: req.temperature ?? 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${err}`)
  }

  const data: OpenRouterResponse = await res.json()
  const choice = data.choices?.[0]

  if (!choice) throw new Error('OpenRouter returned no choices')

  return {
    content:      choice.message.content,
    inputTokens:  data.usage.prompt_tokens,
    outputTokens: data.usage.completion_tokens,
    modelUsed:    data.model, // log actual model — OR may route to fallback
  }
}

// ── Streaming completion ───────────────────────
// Used by Maya chat — yields text chunks as they arrive

export async function* openRouterStream(
  req: OpenRouterRequest
): AsyncGenerator<string> {
  const res = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.agent7even.com',
      'X-Title':      'Agent7even',
    },
    body: JSON.stringify({ ...req, stream: true }),
  })

  if (!res.ok || !res.body) {
    throw new Error(`OpenRouter stream error ${res.status}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

    for (const line of lines) {
      const json = line.slice(6).trim()
      if (json === '[DONE]') return

      try {
        const parsed = JSON.parse(json)
        const text = parsed.choices?.[0]?.delta?.content
        if (text) yield text
      } catch {
        // Partial chunk — continue
      }
    }
  }
}

// ── Model fallback chain ───────────────────────
// If primary model fails, try fallbacks in order
// Useful for Opus (expensive) — fall back to Sonnet if quota hit

export async function openRouterCompleteWithFallback(
  req: OpenRouterRequest,
  fallbacks: string[]
): Promise<{ content: string; inputTokens: number; outputTokens: number; modelUsed: string }> {
  const modelsToTry = [req.model, ...fallbacks]

  for (const model of modelsToTry) {
    try {
      return await openRouterComplete({ ...req, model })
    } catch (err) {
      const isLast = model === modelsToTry[modelsToTry.length - 1]
      if (isLast) throw err
      console.warn(`Model ${model} failed, trying fallback...`)
    }
  }

  throw new Error('All model fallbacks exhausted')
}

// ── Convenience wrappers per agent tier ───────

export const runLightAgent = (messages: OpenRouterMessage[], system?: string) =>
  openRouterComplete({
    model: 'anthropic/claude-haiku-4-5',
    messages: system
      ? [{ role: 'system', content: system }, ...messages]
      : messages,
    max_tokens: 1000,
    temperature: 0.5,
  })

export const runStandardAgent = (messages: OpenRouterMessage[], system?: string) =>
  openRouterComplete({
    model: 'anthropic/claude-sonnet-4',
    messages: system
      ? [{ role: 'system', content: system }, ...messages]
      : messages,
    max_tokens: 2000,
    temperature: 0.7,
  })

export const runDeepAgent = (messages: OpenRouterMessage[], system?: string) =>
  openRouterCompleteWithFallback(
    {
      model: 'anthropic/claude-opus-4',
      messages: system
        ? [{ role: 'system', content: system }, ...messages]
        : messages,
      max_tokens: 4000,
      temperature: 0.7,
    },
    ['anthropic/claude-sonnet-4'] // fallback if Opus quota hit
  )

export const runAutonomousAgent = (messages: OpenRouterMessage[], system?: string) =>
  openRouterComplete({
    model: 'google/gemini-2.5-flash',
    messages: system
      ? [{ role: 'system', content: system }, ...messages]
      : messages,
    max_tokens: 1500,
    temperature: 0.4,
  })
