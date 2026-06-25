// lib/agents/cost.ts
// ─────────────────────────────────────────────
// OpenRouter-based cost calculator
// Fetches live pricing from OpenRouter API
// Caches in platform_settings to avoid rate limits
// ─────────────────────────────────────────────

import { createServiceClient } from '@/lib/supabase/server'

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1'
const CACHE_KEY = 'openrouter_model_pricing'
const CACHE_TTL_HOURS = 6

// OpenRouter model IDs used in registry
export const AGENT_MODELS = {
  opus:         'anthropic/claude-opus-4',
  sonnet:       'anthropic/claude-sonnet-4',
  haiku:        'anthropic/claude-haiku-4-5',
  gemini_flash: 'google/gemini-2.5-flash',
} as const

export type AgentModel = typeof AGENT_MODELS[keyof typeof AGENT_MODELS]

interface OpenRouterModelPricing {
  prompt: string      // cost per token as string e.g. "0.000003"
  completion: string
}

interface OpenRouterModel {
  id: string
  pricing: OpenRouterModelPricing
}

interface CachedPricing {
  fetched_at: string
  models: Record<string, { input_per_token: number; output_per_token: number }>
}

// ── Fetch + cache pricing ──────────────────────

export async function getModelPricing(): Promise<
  Record<string, { input_per_token: number; output_per_token: number }>
> {
  const supabase = createServiceClient()

  // Check cache first
  const { data: cached } = await supabase
    .from('platform_settings')
    .select('value, updated_at')
    .eq('key', CACHE_KEY)
    .single()

  if (cached?.value) {
    const parsed = cached.value as CachedPricing
    const ageHours =
      (Date.now() - new Date(parsed.fetched_at).getTime()) / 1000 / 3600

    if (ageHours < CACHE_TTL_HOURS) {
      return parsed.models
    }
  }

  // Fetch fresh from OpenRouter
  const res = await fetch(`${OPENROUTER_API_BASE}/models`, {
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    next: { revalidate: 0 }, // never use Next cache — we manage our own
  })

  if (!res.ok) {
    // Return cached stale data rather than failing hard
    if (cached?.value) {
      console.warn('OpenRouter pricing fetch failed — using stale cache')
      return (cached.value as CachedPricing).models
    }
    // Last resort: hardcoded fallback (rough approximations)
    return FALLBACK_PRICING
  }

  const json = await res.json()
  const models: OpenRouterModel[] = json.data ?? []

  // Only store models we actually use
  const relevant = Object.values(AGENT_MODELS)
  const pricing: CachedPricing['models'] = {}

  for (const model of models) {
    if (relevant.includes(model.id as AgentModel)) {
      pricing[model.id] = {
        input_per_token:  parseFloat(model.pricing.prompt),
        output_per_token: parseFloat(model.pricing.completion),
      }
    }
  }

  // Persist to platform_settings
  const payload: CachedPricing = { fetched_at: new Date().toISOString(), models: pricing }
  await supabase
    .from('platform_settings')
    .upsert({ key: CACHE_KEY, value: payload, updated_at: new Date().toISOString() })

  return pricing
}

// ── Fallback pricing (if OpenRouter unreachable) ──
// Based on OpenRouter rates as of May 2026 — update if stale

const FALLBACK_PRICING: Record<string, { input_per_token: number; output_per_token: number }> = {
  'anthropic/claude-opus-4':     { input_per_token: 0.000015,   output_per_token: 0.000075   },
  'anthropic/claude-sonnet-4':   { input_per_token: 0.000003,   output_per_token: 0.000015   },
  'anthropic/claude-haiku-4-5':  { input_per_token: 0.0000008,  output_per_token: 0.000004   },
  'google/gemini-2.5-flash':     { input_per_token: 0.00000015, output_per_token: 0.0000006  },
}

// ── Calculate cost ─────────────────────────────

export async function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<number> {
  const pricing = await getModelPricing()
  const rates = pricing[model] ?? FALLBACK_PRICING[model]

  if (!rates) {
    console.warn(`No pricing found for model: ${model} — using Sonnet rates as fallback`)
    const fallback = FALLBACK_PRICING['anthropic/claude-sonnet-4']
    return parseFloat(
      ((inputTokens * fallback.input_per_token) + (outputTokens * fallback.output_per_token)).toFixed(6)
    )
  }

  return parseFloat(
    ((inputTokens * rates.input_per_token) + (outputTokens * rates.output_per_token)).toFixed(6)
  )
}

// ── Synchronous version (uses fallback only) ───
// Use when you can't await — e.g. in middleware or edge functions

export function calculateCostSync(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = FALLBACK_PRICING[model] ?? FALLBACK_PRICING['anthropic/claude-sonnet-4']
  return parseFloat(
    ((inputTokens * rates.input_per_token) + (outputTokens * rates.output_per_token)).toFixed(6)
  )
}

// ── Credit tiers ───────────────────────────────

import { ACTION_CREDIT_COST } from '@/lib/credits/actionCosts'

export type RunTier = 'light' | 'standard' | 'deep'

/** @deprecated Use ACTION_CREDIT_COST — kept for tier classification only */
export const CREDIT_COST: Record<RunTier, number> = {
  light:    ACTION_CREDIT_COST.text_run,
  standard: ACTION_CREDIT_COST.text_run,
  deep:     ACTION_CREDIT_COST.image_standard,
}

export function classifyRunTier(subagentCount: number): RunTier {
  if (subagentCount <= 1) return 'light'
  if (subagentCount <= 4) return 'standard'
  return 'deep'
}

export const BUDGET_CAPS_USD: Record<string, number> = {
  starter:  0.50,
  growth:   2.00,
  proagent: 5.00,
}
