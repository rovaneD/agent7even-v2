import { createOpenRouter } from '@openrouter/ai-sdk-provider'

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
  headers: {
    'HTTP-Referer': 'https://app.agent7even.com',
    'X-Title': 'Agent7even',
  },
})

// Model registry — change a model platform-wide by changing one line here
export const models = {
  maya: openrouter('anthropic/claude-sonnet-4'),
  campaignGenerator: openrouter('anthropic/claude-sonnet-4'),
  competitorAnalyzer: openrouter('google/gemini-2.5-flash'),
  contentWriter: openrouter('anthropic/claude-haiku-4-5'),
  brandAnalyzer: openrouter('anthropic/claude-sonnet-4'),
} as const

export type AgentName = keyof typeof models
