/** Agent run timestamps — injected into prompts so models do not hallucinate dates. */

const RUN_DATE_TIMEZONE = 'America/Los_Angeles'

export function formatAgentRunDateLong(date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: RUN_DATE_TIMEZONE,
  })
}

import { marketingSiteStructureForSeo } from '@/lib/marketing/seoMetadata'

export function buildSeoScannerRunMetadata(scanDate = formatAgentRunDateLong()): string {
  return `RUN METADATA (authoritative — use exactly):
- Scan date: ${scanDate}
- The report MUST include a line: **Scan Date:** ${scanDate}
- Never use training cutoff dates, December 2024, or any date other than ${scanDate}.

SITE STRUCTURE (only recommend URLs that exist):
${marketingSiteStructureForSeo()}

AUDIT RULES:
- If Website Snapshot lists JSON-LD schema types (Organization, SoftwareApplication, FAQPage), do NOT flag schema as missing.
- If homepage title contains "AI Marketing Strategist" and "Automation", do NOT claim target keywords are missing from the title.
- There is no /features page (redirects to /agents) and no /about or /blog — do not recommend creating meta for those paths.
- Use case pages exist under /use-cases/* (including coaches-creators) — do not claim industry pages are missing without checking URLs.
- H1 "Marketing, managed." plus eyebrow "AI marketing platform for small business" is intentional — do not recommend replacing H1 with generic keyword stuffing.
- Do not use the word "autonomous" to mean auto-publishing — this product is approval-first.`
}

/** Force the report body to show the actual run date even if the model hallucinates. */
export function normalizeSeoScanReportDate(content: string, scanDate: string): string {
  const scanDateLine = `**Scan Date:** ${scanDate}`
  if (/\*\*Scan Date:\*\*/i.test(content)) {
    return content.replace(/\*\*Scan Date:\*\*\s*[^\n]*/i, scanDateLine)
  }
  const headingMatch = content.match(/^#\s+.+\n+/m)
  if (headingMatch) {
    const insertAt = headingMatch.index! + headingMatch[0].length
    return `${content.slice(0, insertAt)}\n${scanDateLine}\n\n${content.slice(insertAt)}`
  }
  return `${scanDateLine}\n\n${content}`
}
