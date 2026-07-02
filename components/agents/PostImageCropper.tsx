'use client'

import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import type { CropPreset } from '@/lib/posts/cropPresets'

type Props = {
  imageUrl: string
  filename: string
  presets: CropPreset[]
  defaultPresetId?: string
  onCancel: () => void
  onSkip: () => void
  onComplete: (result: { pixelCrop: Area; preset: CropPreset }) => void
}

const COMMON_FALLBACK: CropPreset = {
  id: '4:5',
  label: 'Portrait feed',
  aspectLabel: '4:5',
  aspect: 4 / 5,
}

export default function PostImageCropper({
  imageUrl,
  filename,
  presets,
  defaultPresetId,
  onCancel,
  onSkip,
  onComplete,
}: Props) {
  const initialPreset =
    presets.find(p => p.id === defaultPresetId) ?? presets[0] ?? COMMON_FALLBACK

  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [preset, setPreset] = useState<CropPreset>(initialPreset)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  function handleApply() {
    if (!croppedAreaPixels) return
    onComplete({ pixelCrop: croppedAreaPixels, preset })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-sm font-semibold text-text-primary">Crop for post</p>
          <p className="mt-1 text-sm text-text-sec">
            Frame {filename} before Maya reads it. You can skip if the image is already sized.
          </p>
        </div>

        <div className="relative h-[min(52vh,360px)] bg-[#0E0E11]">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={preset.aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="space-y-3 border-b border-gray-100 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-menu-muted">Aspect</p>
          <div className="flex flex-wrap gap-2">
            {presets.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPreset(item)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  preset.id === item.id
                    ? 'bg-brand-primary text-white'
                    : 'border border-gray-100 bg-surface text-text-sec hover:border-border-strong'
                }`}
              >
                {item.label} · {item.aspectLabel}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 text-sm text-text-sec">
            <span className="w-12 shrink-0">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="w-full accent-[#3B82F6]"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-text-sec hover:text-text-primary"
          >
            Cancel
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-2"
            >
              Skip crop
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!croppedAreaPixels}
              className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Use cropped image
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
