/** Single source of truth for credit debits (A3 retune). */
export const ACTION_CREDIT_COST = {
  text_run: 0,
  maya_chat_turn: 0,
  image_standard: 3,
  image_premium: 15,
  video_standard: 10,
  video_premium: 40,
  publish: 1,
  brandkit_gen: 1,
  foundation_gen: 0,
} as const

export type ActionCreditKey = keyof typeof ACTION_CREDIT_COST

export const PREMIUM_IMAGE_MODEL_IDS = new Set(['sharp-text'])
export const PREMIUM_IMAGE_OPENROUTER_MODELS = new Set(['recraft/recraft-v4-pro'])

export const PREMIUM_VIDEO_MODEL_IDS = new Set([
  'kling-v3-std',
  'kling-v3-pro',
  'kling-video-o1',
])

export function imageCreditCost(modelId: string | null | undefined, plan: string | null | undefined): number {
  const isPremium = Boolean(
    modelId &&
      (PREMIUM_IMAGE_MODEL_IDS.has(modelId) || PREMIUM_IMAGE_OPENROUTER_MODELS.has(modelId)),
  )
  if (isPremium && plan !== 'proagent') return -1
  return isPremium ? ACTION_CREDIT_COST.image_premium : ACTION_CREDIT_COST.image_standard
}

export function videoCreditCost(modelId: string | null | undefined, plan: string | null | undefined): number {
  const isPremium = modelId && PREMIUM_VIDEO_MODEL_IDS.has(modelId)
  if (isPremium && plan !== 'proagent') return -1
  return isPremium ? ACTION_CREDIT_COST.video_premium : ACTION_CREDIT_COST.video_standard
}

export function isPremiumModelBlocked(plan: string | null | undefined): boolean {
  return plan !== 'proagent'
}
