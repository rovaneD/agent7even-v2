/** User-facing image model ids (server maps to OpenRouter slugs). */
export type ImageGenerationModelId =
  | 'balanced'
  | 'sharp-text'
  | 'photoreal'
  | 'latest-gemini'

export type ImageGenerationModelCatalogEntry = {
  id: ImageGenerationModelId
  label: string
  subtitle: string
  openRouterModel: string
  hint: string
  /** Guides QA expectations in UI copy. */
  textReliability: 'good' | 'better' | 'minimal-only'
  recommended?: boolean
}

export const IMAGE_GENERATION_MODEL_CATALOG: ImageGenerationModelCatalogEntry[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    subtitle: 'Gemini Flash Image',
    openRouterModel: 'google/gemini-2.5-flash-image',
    hint: 'Fast default — general social posts',
    textReliability: 'good',
    recommended: true,
  },
  {
    id: 'sharp-text',
    label: 'Sharp text',
    subtitle: 'Recraft V4 Pro',
    openRouterModel: 'recraft/recraft-v4-pro',
    hint: 'Layout + headlines — still run text QA',
    textReliability: 'better',
  },
  {
    id: 'photoreal',
    label: 'Photoreal',
    subtitle: 'Flux 2 Pro',
    openRouterModel: 'black-forest-labs/flux.2-pro',
    hint: 'Abstract or photo-real — minimal on-image text',
    textReliability: 'minimal-only',
  },
  {
    id: 'latest-gemini',
    label: 'Latest Gemini',
    subtitle: 'Gemini 3.1 Flash Image',
    openRouterModel: 'google/gemini-3.1-flash-image-preview',
    hint: 'Newer Google image model (preview)',
    textReliability: 'good',
  },
]

export function catalogEntryForId(id: string | null | undefined): ImageGenerationModelCatalogEntry | null {
  return IMAGE_GENERATION_MODEL_CATALOG.find(m => m.id === id) ?? null
}

export function listImageModelsForClient() {
  return IMAGE_GENERATION_MODEL_CATALOG.map(
    ({ id, label, subtitle, hint, textReliability, recommended }) => ({
      id,
      label,
      subtitle,
      hint,
      textReliability,
      recommended: !!recommended,
    }),
  )
}

/** Server: resolve user pick or env default to an allowlisted OpenRouter model. */
export function resolveImageGenerationModel(modelId?: string | null): ImageGenerationModelCatalogEntry {
  const picked = catalogEntryForId(modelId)
  if (picked) return picked

  const envModel = process.env.IMAGE_GENERATION_MODEL?.trim()
  if (envModel) {
    const bySlug = IMAGE_GENERATION_MODEL_CATALOG.find(m => m.openRouterModel === envModel)
    if (bySlug) return bySlug
  }

  return IMAGE_GENERATION_MODEL_CATALOG.find(m => m.recommended) ?? IMAGE_GENERATION_MODEL_CATALOG[0]!
}
