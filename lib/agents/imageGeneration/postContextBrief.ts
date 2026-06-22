/** Single-post form fields → brief block for image generation (not caption-only). */
export function formatPostContextBriefBlock(form: Record<string, string> | undefined): string | null {
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

  return [
    '## This post ask (honor in every image option)',
    ...lines,
    '- Visuals should support this specific post — not generic brand awareness only.',
  ].join('\n')
}
