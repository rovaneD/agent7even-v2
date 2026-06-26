import { AGENTS, type AgentId } from '@/lib/agents/registry'

export function agentDisplayName(agentId: string): string {
  return AGENTS[agentId as AgentId]?.name ?? agentId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function cleanPreviewFragment(text: string): string {
  const cleaned = text
    .replace(/\*\*/g, '')
    .replace(/^OVERVIEW:\s*/i, '')
    .replace(/^SUMMARY:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(0, 72) + (cleaned.length > 72 ? '…' : '')
}

/** Human-readable title + subtitle for digest / dashboard brief rows. */
export function formatDigestPreview(raw: string, agentId: string): { title: string; subtitle: string } {
  const agentName = agentDisplayName(agentId)
  const trimmed = raw.trim()

  if (!trimmed) {
    return { title: agentName, subtitle: 'Ready for your review' }
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      const pick =
        parsed.title ?? parsed.headline ?? parsed.subject ?? parsed.hook ??
        parsed.campaign_name ?? parsed.name
      if (typeof pick === 'string' && pick.trim()) {
        return { title: pick.trim(), subtitle: agentName }
      }
    } catch {
      /* fall through */
    }
    return { title: agentName, subtitle: 'Structured output ready for review' }
  }

  const firstHeading = trimmed
    .split('\n')
    .map(line => line.trim())
    .find(line => line.startsWith('#'))
    ?.replace(/^#+\s*/, '')

  if (firstHeading) {
    const bodyLine = trimmed
      .split('\n')
      .map(line => line.trim())
      .find(line => line && !line.startsWith('#') && !line.startsWith('---'))
    const subtitle = bodyLine ? cleanPreviewFragment(bodyLine) : agentName
    return { title: firstHeading.replace(/\*\*/g, ''), subtitle }
  }

  const oneLine = trimmed.replace(/\s+/g, ' ')
  if (oneLine.length <= 72) {
    return { title: oneLine, subtitle: agentName }
  }

  return {
    title: oneLine.slice(0, 72) + '…',
    subtitle: agentName,
  }
}
