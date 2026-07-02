import type { ImageFormatSpec } from '@/lib/agents/contentPosting/platformFormats'

export type CropPreset = {
  id: string
  label: string
  aspectLabel: string
  /** Width / height for react-easy-crop */
  aspect: number
}

export const COMMON_CROP_PRESETS: CropPreset[] = [
  { id: '1:1', label: 'Square', aspectLabel: '1:1', aspect: 1 },
  { id: '4:5', label: 'Portrait feed', aspectLabel: '4:5', aspect: 4 / 5 },
  { id: '9:16', label: 'Story / Reel', aspectLabel: '9:16', aspect: 9 / 16 },
  { id: '16:9', label: 'Landscape', aspectLabel: '16:9', aspect: 16 / 9 },
  { id: '1.91:1', label: 'LinkedIn / Facebook', aspectLabel: '1.91:1', aspect: 1.91 },
]

export function cropPresetFromImageFormat(format: ImageFormatSpec): CropPreset {
  return {
    id: format.id,
    label: format.label,
    aspectLabel: format.aspectRatio,
    aspect: format.width / format.height,
  }
}

export function cropPresetsForFormat(format: ImageFormatSpec | null | undefined): CropPreset[] {
  if (!format) return COMMON_CROP_PRESETS
  const primary = cropPresetFromImageFormat(format)
  const rest = COMMON_CROP_PRESETS.filter(p => p.id !== primary.id && p.aspectLabel !== primary.aspectLabel)
  return [primary, ...rest]
}

export type MediaEditMetadata = {
  cropped: boolean
  aspect: string
  source_filename?: string
}
