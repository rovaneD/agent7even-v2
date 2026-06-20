import { loadFoundationContext } from '@/lib/agents/loadFoundationContext'

/** Markdown bundle for brief composition (spike pattern + loadFoundationContext). */
export async function buildFoundationSnapshotMarkdown(
  profileId: string,
  companyName: string,
): Promise<string> {
  const ctx = await loadFoundationContext(profileId)
  const sections: string[] = [
    `# Foundation snapshot — ${companyName}`,
    `Profile ID: ${profileId}`,
    '',
    '## Documents',
  ]

  for (const [type, markdown] of Object.entries(ctx.documents)) {
    if (markdown.trim()) sections.push(`### ${type}\n${markdown.trim()}\n`)
  }

  sections.push('## Raw answers')
  for (const [key, value] of Object.entries(ctx.answers)) {
    if (!value.trim()) continue
    sections.push(`- **${key}**: ${value}`)
  }

  if (ctx.competitorsFreetext) {
    sections.push(`\n## Competitors (answers)\n${ctx.competitorsFreetext}`)
  }

  return sections.join('\n')
}
