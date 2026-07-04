import { agentDisplayName } from '@/lib/agents/digestPreview'
import { agentOutputContentText } from '@/lib/agents/agentOutputText'

export type FoundationChangelogSignalType = 'approved' | 'rejected' | 'edited'

const CTA_PHRASES: { pattern: RegExp; label: string }[] = [
  { pattern: /\bbuy now\b/i, label: 'Buy now' },
  { pattern: /\blearn more\b/i, label: 'Learn more' },
  { pattern: /\bshop now\b/i, label: 'Shop now' },
  { pattern: /\bget started\b/i, label: 'Get started' },
  { pattern: /\bsign up\b/i, label: 'Sign up' },
  { pattern: /\bbook (?:a )?call\b/i, label: 'Book a call' },
]

function excerpt(text: string, max = 60): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return '(empty)'
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1)}…`
}

function firstSentence(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  const match = cleaned.match(/^[^.!?]+[.!?]?/)
  return match?.[0]?.trim() || cleaned.slice(0, 120)
}

function findCta(text: string): string | null {
  for (const { pattern, label } of CTA_PHRASES) {
    if (pattern.test(text)) return label
  }
  return null
}

function inferContentAngle(text: string): string | null {
  const lower = text.toLowerCase()
  if (/\bcommunity\b|\btogether\b|\blocal\b|\bneighbors?\b/.test(lower)) {
    return 'community-focused'
  }
  if (/\bpric(e|ing)\b|\$\d|\bcost\b|\bafford/.test(lower)) {
    return 'pricing-focused'
  }
  if (/\bcompetitor\b|\bversus\b|\bvs\.?\b|\bcompare/.test(lower)) {
    return 'competitor-comparison'
  }
  if (/\bfeature\b|\bproduct\b|\blaunch\b|\bnew\b/.test(lower)) {
    return 'product-feature'
  }
  return null
}

function describeTextEdit(before: string, after: string): string {
  const beforeCta = findCta(before)
  const afterCta = findCta(after)
  if (beforeCta && afterCta && beforeCta !== afterCta) {
    return `changed CTA from "${beforeCta}" to "${afterCta}"`
  }

  const beforeOpen = excerpt(firstSentence(before), 50)
  const afterOpen = excerpt(firstSentence(after), 50)
  if (beforeOpen !== afterOpen && beforeOpen !== '(empty)' && afterOpen !== '(empty)') {
    return `changed opening from "${beforeOpen}" to "${afterOpen}"`
  }

  if (before.trim() !== after.trim()) {
    return 'updated caption text before approval'
  }

  return 'approved with minor formatting changes'
}

export function summarizeApprovedOutput(opts: {
  agentId: string
  content: unknown
  title?: string | null
}): string {
  const agentName = agentDisplayName(opts.agentId)
  const text = agentOutputContentText(opts.content)
  const titleBit = opts.title?.trim() ? ` "${opts.title.trim()}"` : ''
  const angle = inferContentAngle(text)

  if (angle) {
    return `Approved ${angle} ${agentName} output${titleBit} without edits`
  }

  const preview = excerpt(text, 55)
  if (preview !== '(empty)') {
    return `Approved ${agentName} output${titleBit}: "${preview}"`
  }

  return `Approved ${agentName} output${titleBit} without edits`
}

export function summarizeEditedAndApprovedOutput(opts: {
  agentId: string
  beforeContent: unknown
  afterContent: unknown
  title?: string | null
}): { summary: string; signalType: 'edited' } {
  const agentName = agentDisplayName(opts.agentId)
  const before = agentOutputContentText(opts.beforeContent)
  const after = agentOutputContentText(opts.afterContent)
  const titleBit = opts.title?.trim() ? ` (${opts.title.trim()})` : ''
  const editDetail = describeTextEdit(before, after)

  return {
    signalType: 'edited',
    summary: `Edited and approved ${agentName} output${titleBit} — ${editDetail}`,
  }
}

export function summarizeRejectedOutput(opts: {
  agentId: string
  content?: unknown
  title?: string | null
  rejectionReason?: string | null
  feedbackNote?: string | null
}): string {
  const agentName = agentDisplayName(opts.agentId)
  const text = opts.content != null ? agentOutputContentText(opts.content) : ''
  const titleBit = opts.title?.trim() ? ` "${opts.title.trim()}"` : ''
  const angle = text ? inferContentAngle(text) : null
  const subject = angle
    ? `${angle} ${agentName} output${titleBit}`
    : `${agentName} output${titleBit}`

  const reasonText = opts.feedbackNote?.trim() || opts.rejectionReason?.trim()
  if (reasonText) {
    return `Rejected ${subject} — ${excerpt(reasonText, 80)}`
  }

  const preview = excerpt(text, 50)
  if (preview !== '(empty)') {
    return `Rejected ${agentName} output about "${preview}"`
  }

  return `Rejected ${subject}`
}
