/** Single-post form fields → brief block for image/video generation (not caption-only). */
export function formatPostContextBriefBlock(
  form: Record<string, string> | undefined,
  medium: 'image' | 'video' = 'image',
): string | null {
  if (!form) return null

  const lines: string[] = []
  const add = (label: string, key: string) => {
    const v = form[key]?.trim()
    if (v) lines.push(`- ${label}: ${v}`)
  }

  add('Platform', 'platform')
  add('Post goal', 'postGoal')
  add('Audience', 'audience')
  add('Offer / CTA', 'offer')
  add('Must include', 'mustInclude')
  add('Must avoid', 'mustAvoid')

  if (lines.length === 0) return null

  const mediumLine = medium === 'video'
    ? '- Honor in the video brief — scene, motion, and text overlay must support this specific post.'
    : '- Honor in every image option — non-negotiable.'

  return [
    '## This post ask (non-negotiable)',
    ...lines,
    mediumLine,
    '- Visuals must support this specific post — not generic brand awareness only.',
    '- Quote a concrete headline (max 8 words) tied to Post goal and customer pain.',
    '- Offer/CTA field informs headline angle and caption — do NOT bake CTA buttons into the visual.',
    '- Do NOT use vague lifestyle scenes (coffee chat, generic "boost your brand") unless the post ask explicitly requests them.',
  ].join('\n')
}
