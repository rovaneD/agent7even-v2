import { openRouterComplete } from '@/lib/agents/openrouter'
import {
  type KnowledgeClassification,
  type KnowledgePurposeConfidence,
  type KnowledgeSourcePurpose,
  KNOWLEDGE_PURPOSE_LABELS,
  normalizeKnowledgePurpose,
} from '@/lib/foundation/knowledgePurpose'

export type { KnowledgeClassification, KnowledgePurposeConfidence, KnowledgeSourcePurpose } from '@/lib/foundation/knowledgePurpose'
export {
  KNOWLEDGE_PURPOSE_LABELS,
  KNOWLEDGE_PURPOSE_AGENT_NOTE,
  KNOWLEDGE_SOURCE_PURPOSES,
  normalizeKnowledgePurpose,
  isCompetitorPurpose,
} from '@/lib/foundation/knowledgePurpose'

const CLASSIFY_MODEL = 'anthropic/claude-haiku-4-5'

function hostFromUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(withProto).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

function heuristicClassification(
  sourceType: string,
  sourceName: string,
  ownerWebsiteUrl?: string | null,
): KnowledgeClassification | null {
  const sourceHost = sourceType === 'url' ? hostFromUrl(sourceName) : null
  const ownerHost = hostFromUrl(ownerWebsiteUrl)

  if (sourceHost && ownerHost) {
    if (sourceHost === ownerHost || sourceHost.endsWith(`.${ownerHost}`)) {
      return {
        purpose: 'own_business',
        confidence: 'high',
        reason: 'URL matches the workspace website domain.',
      }
    }
    return {
      purpose: 'competitor',
      confidence: 'medium',
      reason: 'External URL does not match the workspace website domain.',
    }
  }

  const lower = sourceName.toLowerCase()
  if (/\b(testimonial|review|customer story|case study quote)\b/.test(lower)) {
    return {
      purpose: 'customer_voice',
      confidence: 'medium',
      reason: 'Filename or label suggests customer/testimonial content.',
    }
  }

  return null
}

function parseClassification(raw: string): KnowledgeClassification | null {
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned) as {
      purpose?: string
      confidence?: string
      reason?: string
    }
    const purpose = normalizeKnowledgePurpose(parsed.purpose) ?? 'unknown'
    const confidence: KnowledgePurposeConfidence =
      parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
        ? parsed.confidence
        : 'low'
    const reason = typeof parsed.reason === 'string' && parsed.reason.trim()
      ? parsed.reason.trim()
      : KNOWLEDGE_PURPOSE_LABELS[purpose]
    return { purpose, confidence, reason }
  } catch {
    return null
  }
}

/** Classify uploaded/linked source material — competitor vs own-business vs market context. */
export async function classifyKnowledgeSource(
  text: string,
  sourceType: string,
  sourceName: string,
  ownerWebsiteUrl?: string | null,
): Promise<KnowledgeClassification> {
  const heuristic = heuristicClassification(sourceType, sourceName, ownerWebsiteUrl)
  if (heuristic?.confidence === 'high') return heuristic

  if (!text.trim()) {
    return heuristic ?? {
      purpose: 'unknown',
      confidence: 'low',
      reason: 'No readable text to classify.',
    }
  }

  const ownerHost = hostFromUrl(ownerWebsiteUrl)
  const prompt = `Classify this business document for a marketing knowledge library.

Source type: ${sourceType}
Source label: ${sourceName}
${ownerHost ? `Owner website host: ${ownerHost}` : 'Owner website: unknown'}

Purpose categories (pick exactly one):
- own_business: about the client's own company, products, brand, or official site
- competitor: about a competitor's business, offers, positioning, or website
- market_reference: industry trends, benchmarks, or generic market info (not a specific competitor)
- customer_voice: testimonials, reviews, or customer quotes
- unknown: cannot determine

Document excerpt (first 2500 chars):
${text.slice(0, 2500)}

Return JSON only:
{"purpose":"own_business|competitor|market_reference|customer_voice|unknown","confidence":"high|medium|low","reason":"one short sentence"}`

  try {
    const res = await openRouterComplete({
      model: CLASSIFY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0,
    })
    const parsed = parseClassification(res.content)
    if (parsed) {
      if (heuristic && heuristic.purpose === 'competitor' && parsed.purpose === 'own_business' && parsed.confidence !== 'high') {
        return heuristic
      }
      return parsed
    }
  } catch (err) {
    console.error('[classifyKnowledge] OpenRouter failed:', err instanceof Error ? err.message : err)
  }

  return heuristic ?? {
    purpose: 'unknown',
    confidence: 'low',
    reason: 'Automatic classification unavailable.',
  }
}
