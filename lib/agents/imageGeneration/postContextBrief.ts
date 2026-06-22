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
    '## This post ask (honor in every image option — non-negotiable)',
    ...lines,
    '- Visuals must support this specific post — not generic brand awareness only.',
    '- Quote a concrete headline tied to Post goal and customer pain; include a visible CTA button or line when Offer/CTA is set.',
    '- Do NOT use vague lifestyle scenes (coffee chat, generic "boost your brand") unless the post ask explicitly requests them.',
  ].join('\n')
}
