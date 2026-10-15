import type { ActionCreditKey } from '@/lib/credits/actionCosts'
import {
  imageCreditCost,
  PREMIUM_IMAGE_MODEL_IDS,
  PREMIUM_IMAGE_OPENROUTER_MODELS,
  PREMIUM_VIDEO_MODEL_IDS,
  videoCreditCost,
} from '@/lib/credits/actionCosts'

export function resolveImageActionType(
  modelIdOrSlug: string | null | undefined,
  plan: string | null | undefined,
): ActionCreditKey {
  const slug = modelIdOrSlug ?? ''
  const premium =
    Boolean(slug)
    && (PREMIUM_IMAGE_MODEL_IDS.has(slug)
      || PREMIUM_IMAGE_OPENROUTER_MODELS.has(slug)
      || slug.includes('recraft'))
  if (premium) return 'image_premium'
  const cost = imageCreditCost(modelIdOrSlug, plan)
  if (cost === -1) return 'image_premium'
  return 'image_standard'
}

export function resolveVideoActionType(
  modelId: string | null | undefined,
  plan: string | null | undefined,
): ActionCreditKey {
  const premium = Boolean(modelId && PREMIUM_VIDEO_MODEL_IDS.has(modelId))
  if (premium) return 'video_premium'
  const cost = videoCreditCost(modelId, plan)
  if (cost === -1) return 'video_premium'
  return 'video_standard'
}
