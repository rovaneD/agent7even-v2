import { generateText } from 'ai'
import { openrouter } from '@/lib/ai/client'
import { fetchWebsiteContent } from '@/lib/foundation/fetchWebsiteContent'
import { parseSiteSnapshot, type SiteSnapshot, SiteSnapshotSchema } from '@/lib/foundation/siteSnapshot'

const ENRICHMENT_MODEL = 'anthropic/claude-sonnet-4'

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i)
  if (fenced) return fenced[1].trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)
  return trimmed
}

export async function enrichFromWebsite(opts: {
  websiteUrl: string
  companyName?: string | null
}): Promise<SiteSnapshot> {
  const content = await fetchWebsiteContent(opts.websiteUrl)
  if (!content?.text) {
    throw new Error('Could not read website content. Check the URL loads in a browser.')
  }

  const system = `You are a senior marketing strategist extracting a structured brand profile from website content.

Output ONLY valid JSON matching this schema (no markdown fences):
{
  "businessOverview": "2-4 sentences on what the business is and does",
  "marketPositioning": {
    "primary": "one-line primary positioning",
    "secondary": "optional secondary angle",
    "tertiary": "optional tertiary angle"
  },
  "competitors": {
    "local": ["optional local competitor names"],
    "international": ["optional broader competitor names"]
  },
  "competitiveAdvantages": ["3-5 specific differentiators evidenced on the site"],
  "customerSegments": [
    { "label": "Segment name", "shareHint": "optional e.g. 40%", "description": "who they are and why they buy" }
  ],
  "fetchedAt": "ISO-8601 timestamp",
  "sourceUrl": "canonical URL"
}

Rules:
- Ground every claim in the provided website text. Do not invent testimonials, metrics, or pricing not on the site.
- Infer segments and competitors only when reasonable from context; use empty arrays if unknown.
- Use clear, strategic language comparable to a brand strategist deck — not generic marketing fluff.
- Set fetchedAt to the current UTC ISO time and sourceUrl to the page URL provided.`

  const user = `Company name: ${opts.companyName?.trim() || 'Unknown'}
Website URL: ${content.url}
Fetch source: ${content.source}
${content.title ? `Page title: ${content.title}\n` : ''}
Website text:
${content.text}`

  const { text } = await generateText({
    model: openrouter(ENRICHMENT_MODEL),
    system,
    messages: [{ role: 'user', content: user }],
    maxOutputTokens: 2000,
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(text))
  } catch {
    throw new Error('Failed to parse website enrichment response')
  }

  const snapshot = parseSiteSnapshot(parsed)
  if (!snapshot) {
    throw new Error('Website enrichment returned invalid snapshot shape')
  }

  // Always stamp server time — models often hallucinate dates
  return SiteSnapshotSchema.parse({
    ...snapshot,
    sourceUrl: content.url,
    fetchedAt: new Date().toISOString(),
  })
}
