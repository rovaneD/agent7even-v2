/** Split Campaign Builder markdown into review-friendly blocks. */

export type CampaignDay = {
  label: string
  items: string[]
}

export type CampaignWeek = {
  number: string
  theme: string
  days: CampaignDay[]
}

export type CampaignSection = {
  title: string
  body: string[]
  bullets: string[]
}

export type ParsedCampaign = {
  title: string
  overview: string
  budgetAssumption: string
  weeks: CampaignWeek[]
  sections: CampaignSection[]
  remainder: string
}

const WEEK_HEADING =
  /(?:^|\n)\s*#{0,3}\s*\*{0,2}\s*WEEK\s+(\d+)\s*:?\s*\*{0,2}\s*([^\n]*)/gi

const DAY_HEADING =
  /(?:^|\n)\s*\*{0,2}\s*((?:Day\s+\d+\s*[-–]\s*)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun))\s*\*{0,2}\s*:?\s*/gi

const TRAILING_SECTION =
  /(?:^|\n)\s*#{0,3}\s*\*{0,2}\s*(CONTENT CALENDAR|EMAIL(?: SEQUENCE)?|BUDGET ALLOCATION|SUCCESS METRICS)\s*\*{0,2}\s*:?\s*/gi

export function stripCampaignMarkdown(value: string): string {
  return value
    .replace(/^#+\s*/g, '')
    .replace(/\*\*/g, '')
    .trim()
}

function extractLabeledBlock(content: string, label: string, stopPattern: RegExp): string {
  const startPattern = new RegExp(`(?:^|\\n)\\s*\\*{0,2}\\s*${label}\\s*:?\\s*\\*{0,2}\\s*`, 'i')
  const startMatch = content.match(startPattern)
  if (startMatch == null || startMatch.index == null) return ''

  const valueStart = startMatch.index + startMatch[0].length
  const tail = content.slice(valueStart)
  const stopMatch = tail.match(stopPattern)
  const valueEnd = stopMatch?.index ?? tail.length
  return tail.slice(0, valueEnd).trim()
}

function parseTitle(content: string): string {
  const match = content.match(/^#\s+(.+?)(?:\n|$)/)
  return match?.[1]?.trim() ?? ''
}

function parseWeekBlock(block: string): CampaignDay[] {
  const dayMatches = [...block.matchAll(DAY_HEADING)]
  const days: CampaignDay[] = []

  for (let dayIndex = 0; dayIndex < dayMatches.length; dayIndex += 1) {
    const dayMatch = dayMatches[dayIndex]
    const dayStart = (dayMatch.index ?? 0) + dayMatch[0].length
    const dayEnd = dayMatches[dayIndex + 1]?.index ?? block.length
    const dayBlock = block.slice(dayStart, dayEnd)
    const items = dayBlock
      .split('\n')
      .map(line => stripCampaignMarkdown(line.replace(/^[-•*]\s*/, '')))
      .filter(Boolean)

    days.push({
      label: stripCampaignMarkdown(dayMatch[1]),
      items,
    })
  }

  return days
}

function parseSectionBlock(block: string): Pick<CampaignSection, 'body' | 'bullets'> {
  const lines = block.replace(/\r\n/g, '\n').split('\n')
  const body: string[] = []
  const bullets: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || /^-{3,}$/.test(line)) continue

    if (/^[-•*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      bullets.push(stripCampaignMarkdown(line.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, '')))
    } else {
      body.push(stripCampaignMarkdown(line))
    }
  }

  return { body, bullets }
}

function parseTrailingSections(content: string): CampaignSection[] {
  const matches = [...content.matchAll(TRAILING_SECTION)]
  if (matches.length === 0) {
    const trimmed = content.trim()
    if (!trimmed) return []
    const { body, bullets } = parseSectionBlock(trimmed)
    return [{ title: 'Additional notes', body, bullets }]
  }

  const sections: CampaignSection[] = []
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const start = (match.index ?? 0) + match[0].length
    const end = matches[index + 1]?.index ?? content.length
    const block = content.slice(start, end)
    const { body, bullets } = parseSectionBlock(block)
    sections.push({
      title: stripCampaignMarkdown(match[1]),
      body,
      bullets,
    })
  }

  return sections
}

export function parseCampaignMarkdown(content: string): ParsedCampaign | null {
  const normalized = content.replace(/\r\n/g, '\n').trim()
  if (!normalized) return null

  const hasCampaignShape =
    /\**OVERVIEW:\**/i.test(normalized) ||
    /(?:^|\n)\s*#{0,3}\s*\*{0,2}\s*WEEK\s+\d+/i.test(normalized)

  if (!hasCampaignShape) return null

  const title = parseTitle(normalized)
  const overview = extractLabeledBlock(
    normalized,
    'OVERVIEW',
    /(?:\n\s*-{3,}|\n\s*#{0,3}\s*\*{0,2}\s*(?:WEEK\s+\d+|Budget Assumption|CONTENT CALENDAR|EMAIL|BUDGET ALLOCATION|SUCCESS METRICS))/i,
  )
  const budgetAssumption = extractLabeledBlock(
    normalized,
    'Budget Assumption',
    /(?:\n\s*-{3,}|\n\s*#{0,3}\s*\*{0,2}\s*WEEK\s+\d+)/i,
  )

  const weekMatches = [...normalized.matchAll(WEEK_HEADING)]
  const weeks: CampaignWeek[] = []
  let lastWeekEnd = 0

  for (let index = 0; index < weekMatches.length; index += 1) {
    const match = weekMatches[index]
    const start = (match.index ?? 0) + match[0].length
    const end = weekMatches[index + 1]?.index ?? normalized.length
    lastWeekEnd = end

    weeks.push({
      number: match[1],
      theme: stripCampaignMarkdown(match[2] || `Week ${match[1]}`),
      days: parseWeekBlock(normalized.slice(start, end)),
    })
  }

  const afterWeeks = lastWeekEnd > 0 ? normalized.slice(lastWeekEnd).trim() : ''
  const sections = afterWeeks ? parseTrailingSections(afterWeeks) : []

  return {
    title,
    overview,
    budgetAssumption,
    weeks,
    sections,
    remainder: afterWeeks,
  }
}

/** Short preview for collapsed approval cards. */
export function campaignPreview(content: string): string | null {
  const parsed = parseCampaignMarkdown(content)
  if (!parsed) return null
  if (parsed.title) return parsed.title
  if (parsed.overview) {
    return parsed.overview.length > 160 ? `${parsed.overview.slice(0, 160)}…` : parsed.overview
  }
  if (parsed.weeks[0]?.theme) return `Week 1 — ${parsed.weeks[0].theme}`
  return null
}

export function actionLabel(item: string): string {
  const lower = item.toLowerCase()
  if (lower.includes('reel')) return 'Reel'
  if (lower.includes('carousel')) return 'Carousel'
  if (lower.includes('stories') || lower.includes('story')) return 'Story'
  if (lower.includes('email')) return 'Email'
  if (lower.includes('google ads') || lower.includes('facebook ad') || lower.includes(' ad ')) return 'Ad'
  if (lower.includes('linkedin')) return 'LinkedIn'
  if (lower.includes('instagram')) return 'Instagram'
  if (lower.includes('comment')) return 'Engage'
  if (lower.includes('post')) return 'Post'
  return 'Action'
}

export function actionColor(label: string): { background: string; color: string } {
  if (label === 'Email') return { background: '#EFF6FF', color: '#2563EB' }
  if (label === 'Ad') return { background: '#F5F3FF', color: '#7C3AED' }
  if (label === 'Engage') return { background: '#ECFDF5', color: '#059669' }
  if (label === 'Instagram') return { background: '#FFF1F2', color: '#E11D48' }
  if (label === 'LinkedIn') return { background: '#EFF6FF', color: '#1D4ED8' }
  if (label === 'Reel' || label === 'Story') return { background: '#FFF7ED', color: '#EA580C' }
  return { background: '#F8FAFC', color: '#64748B' }
}
