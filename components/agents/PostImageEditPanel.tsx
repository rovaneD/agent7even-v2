'use client'

import { useState } from 'react'
import { Loader2, Wand2 } from 'lucide-react'
import type { GeneratedImageOption } from '@/lib/agents/imageGeneration/types'
import { sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'

export type ImageEditMode = 'text-only' | 'visual'

type Props = {
  option: GeneratedImageOption
  disabled?: boolean
  editing?: boolean
  onEdit: (instruction: string, mode: ImageEditMode) => Promise<void>
}

/** Step 4b — targeted revision with text-only vs visual modes. */
export default function PostImageEditPanel({ option, disabled, editing, onEdit }: Props) {
  const [instruction, setInstruction] = useState('')
  const [editMode, setEditMode] = useState<ImageEditMode>('text-only')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = instruction.trim()
    if (!trimmed || editing || disabled) return
    setError(null)
    try {
      await onEdit(trimmed, editMode)
      setInstruction('')
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Edit failed. Try again.'
      setError(sanitizeUserFacingError(raw, 'image_edit'))
    }
  }

  return (
    <form onSubmit={e => void handleSubmit(e)} className="mt-3 rounded-xl border border-gray-100 bg-surface-2/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Wand2 size={14} className="text-brand-primary" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
          Edit this image
        </p>
      </div>
      <p className="mb-2 text-xs text-text-sec">
        <strong className="font-semibold text-text-primary">Fix text only</strong> re-renders with Recraft (sharp headlines).
        Layout may shift slightly, but text should stay legible.
        <strong className="font-semibold text-text-primary"> Change visual</strong> edits the scene from your selected image.
      </p>
      <div className="mb-2 flex gap-2">
        {([
          ['text-only', 'Fix text only'],
          ['visual', 'Change visual'],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            disabled={disabled || editing}
            onClick={() => setEditMode(mode)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              editMode === mode
                ? 'bg-brand-primary text-white'
                : 'border border-gray-200 bg-white text-text-sec hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        value={instruction}
        onChange={e => setInstruction(e.target.value)}
        disabled={disabled || editing}
        rows={2}
        placeholder={
          editMode === 'text-only'
            ? 'Change headline to "Stop wasting money on useless reports" — keep everything else identical'
            : 'Use a male model instead of female, or change the background to a café'
        }
        className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand-primary"
      />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={disabled || editing || !instruction.trim()}
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {editing ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Applying edit…
          </>
        ) : (
          'Apply edit'
        )}
      </button>
    </form>
  )
}
