export type VideoModelId =
  | 'kling-v3-std'
  | 'kling-v3-pro'
  | 'kling-video-o1'
  | 'seedance-2-fast'
  | 'seedance-2'
  | 'seedance-1-5-pro'
  | 'veo-3-1'
  | 'veo-3-1-fast'
  | 'veo-3-1-lite'
  | 'grok-imagine-video'
  | 'hailuo-2-3'
  | 'wan-2-7'
  | 'wan-2-6'
  | 'sora-2-pro'

export type VideoModelEntry = {
  id: VideoModelId
  label: string
  openRouterModel: string
  durationSeconds: number
  aspectRatio: string
}

const VIDEO_MODEL_CATALOG: Record<VideoModelId, VideoModelEntry> = {
  'kling-v3-std': {
    id: 'kling-v3-std',
    label: 'Kling v3.0 Standard',
    openRouterModel: 'kwaivgi/kling-v3.0-std',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'kling-v3-pro': {
    id: 'kling-v3-pro',
    label: 'Kling v3.0 Pro',
    openRouterModel: 'kwaivgi/kling-v3.0-pro',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'kling-video-o1': {
    id: 'kling-video-o1',
    label: 'Kling Video O1',
    openRouterModel: 'kwaivgi/kling-video-o1',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'seedance-2-fast': {
    id: 'seedance-2-fast',
    label: 'Seedance 2.0 Fast',
    openRouterModel: 'bytedance/seedance-2.0-fast',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'seedance-2': {
    id: 'seedance-2',
    label: 'Seedance 2.0',
    openRouterModel: 'bytedance/seedance-2.0',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'seedance-1-5-pro': {
    id: 'seedance-1-5-pro',
    label: 'Seedance 1.5 Pro',
    openRouterModel: 'bytedance/seedance-1-5-pro',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'veo-3-1': {
    id: 'veo-3-1',
    label: 'Google Veo 3.1',
    openRouterModel: 'google/veo-3.1',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'veo-3-1-fast': {
    id: 'veo-3-1-fast',
    label: 'Google Veo 3.1 Fast',
    openRouterModel: 'google/veo-3.1-fast',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'veo-3-1-lite': {
    id: 'veo-3-1-lite',
    label: 'Google Veo 3.1 Lite',
    openRouterModel: 'google/veo-3.1-lite',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'grok-imagine-video': {
    id: 'grok-imagine-video',
    label: 'xAI Grok Imagine Video',
    openRouterModel: 'xai/grok-imagine-video',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'hailuo-2-3': {
    id: 'hailuo-2-3',
    label: 'MiniMax Hailuo 2.3',
    openRouterModel: 'minimax/hailuo-2.3',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'wan-2-7': {
    id: 'wan-2-7',
    label: 'Alibaba Wan 2.7',
    openRouterModel: 'alibaba/wan-2.7',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'wan-2-6': {
    id: 'wan-2-6',
    label: 'Alibaba Wan 2.6',
    openRouterModel: 'alibaba/wan-2.6',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
  'sora-2-pro': {
    id: 'sora-2-pro',
    label: 'OpenAI Sora 2 Pro',
    openRouterModel: 'openai/sora-2-pro',
    durationSeconds: 8,
    aspectRatio: '9:16',
  },
}

export const DEFAULT_VIDEO_MODEL_ID: VideoModelId = 'kling-v3-std'

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

/** Flat list safe to import in client components (no server-only env reads). */
export const VIDEO_MODEL_OPTIONS: Array<{ id: VideoModelId; label: string }> =
  Object.values(VIDEO_MODEL_CATALOG).map(m => ({ id: m.id, label: m.label }))
