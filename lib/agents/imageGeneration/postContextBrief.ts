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

  add('What this post is about', 'topic')
  add('Platform', 'platform')
  add('Post goal (strategy only — never printed)', 'postGoal')
  add('Audience', 'audience')
  add('Offer / CTA (shapes the angle; the CTA itself lives in the caption)', 'offer')
  add('Must include', 'mustInclude')
  add('Must avoid', 'mustAvoid')

  if (lines.length === 0) return null

  const heading = medium === 'video' ? '## This post (the video must serve it)' : '## This post (every option must serve it)'
  return [heading, ...lines].join('\n')
}
