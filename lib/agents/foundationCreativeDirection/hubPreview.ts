import type { CreativeDirection } from './types'

const PREVIEW_MAX = 130

function truncate(text: string): string {
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX)}…` : text
}

/** Card preview for Your Look — mirrors "Tone: …" pattern used by Your Voice. */
export function formatVisualDirectionHubPreview(direction: CreativeDirection): string {
  const v = direction.visualDirection
  const segments: string[] = []

  if (v.aesthetic.trim()) segments.push(v.aesthetic.trim())

  const palette = v.paletteWords.map(w => w.trim()).filter(Boolean).join(' · ')
  if (palette) segments.push(palette)

  const casting = v.casting.trim()
  if (casting) {
    segments.push(casting.length > 48 ? `${casting.slice(0, 45)}…` : casting)
  }

  if (segments.length === 0) return ''
  return truncate(`Look: ${segments.join(' · ')}`)
}

export function visualHubSectionPreview(
  answers: { visualAesthetic?: string },
  creativeDirection: CreativeDirection | null,
): string | null {
  if (creativeDirection) {
    const synthesized = formatVisualDirectionHubPreview(creativeDirection)
    if (synthesized) return synthesized
  }

  const raw = answers.visualAesthetic?.trim()
  return raw ? truncate(raw) : null
}
