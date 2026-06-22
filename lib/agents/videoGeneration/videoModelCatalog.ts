export type VideoModelId = 'kling-v1-5' | 'runway-gen3' | 'luma-dream'

export type VideoModelEntry = {
  id: VideoModelId
  label: string
  openRouterModel: string
  durationSeconds: number
  aspectRatio: string
}

const VIDEO_MODEL_CATALOG: Record<VideoModelId, VideoModelEntry> = {
  'kling-v1-5': {
    id: 'kling-v1-5',
    label: 'Kling v1.5',
    openRouterModel: 'kling/kling-v1-5',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'runway-gen3': {
    id: 'runway-gen3',
    label: 'Runway Gen-3',
    openRouterModel: 'runway/gen-3-alpha-turbo',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'luma-dream': {
    id: 'luma-dream',
    label: 'Luma Dream Machine',
    openRouterModel: 'luma/dream-machine',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
}

const DEFAULT_VIDEO_MODEL_ID: VideoModelId = 'kling-v1-5'

export function resolveVideoModel(id: string | null | undefined): VideoModelEntry {
  const envOverride = process.env.VIDEO_GENERATION_MODEL?.trim()
  if (envOverride) {
    const found = Object.values(VIDEO_MODEL_CATALOG).find(m => m.openRouterModel === envOverride || m.id === envOverride)
    if (found) return found
  }
  if (id && id in VIDEO_MODEL_CATALOG) return VIDEO_MODEL_CATALOG[id as VideoModelId]!
  return VIDEO_MODEL_CATALOG[DEFAULT_VIDEO_MODEL_ID]!
}

export function defaultVideoModelEntry(): VideoModelEntry {
  return resolveVideoModel(null)
}
