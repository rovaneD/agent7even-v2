// Foundation knowledge extraction — maps uploaded content to Foundation fields.
// Text extraction: pdf-parse, mammoth, Exa (URL), raw text.
// Field interpretation: Claude Haiku via OpenRouter.

import { openRouterComplete } from '@/lib/agents/openrouter'
import { exaReadSite } from '@/lib/research/exa'

export type ExtractionItem = {
  field: string
  value: string | string[]
  confidence: 'high' | 'medium' | 'low'
  source: string
  question?: string
}

export type ExtractionResult = {
  items: ExtractionItem[]
  summary: string
}

// ── Text extraction by source type ────────────────────────────────────────────

export async function extractText(
  type: string,
  content: string,  // base64 for files, raw string for text/url
  filename?: string,
): Promise<string> {
  if (type === 'url') {
    const site = await exaReadSite(content)
    const text = site?.text ?? ''
    if (!text.trim()) {
      console.error('[foundation-ingest-diag] extractText(url): empty after exaReadSite', {
        url: content,
        siteReturned: site ? { url: site.url, title: site.title ?? null, textLen: site.text?.length ?? 0 } : null,
      })
    }
    return text
  }

  if (type === 'text') return content

  const buf = Buffer.from(content, 'base64')

  if (type === 'pdf') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const result = await pdfParse(buf)
    return result.text ?? ''
  }

  if (type === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: buf })
    return result.value ?? ''
  }

  // Image: use Claude vision directly via Anthropic API
  if (type === 'image') {
    return extractImageText(content, filename)
  }

  return ''
}

async function extractImageText(base64: string, filename?: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[foundation-ingest-diag] extractImageText: ANTHROPIC_API_KEY missing or empty at runtime', {
      filename: filename ?? null,
      base64Len: base64.length,
    })
    return ''
  }

  const mimeType = filename?.endsWith('.png') ? 'image/png'
    : filename?.endsWith('.webp') ? 'image/webp'
    : 'image/jpeg'

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: 'This is a business document or screenshot. Extract all visible text content, including brand voice indicators, product names and descriptions, competitor names, pricing, and marketing copy. Return the extracted text only.' },
          ],
        }],
      }),
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('[foundation-ingest-diag] extractImageText: Anthropic API error', {
        filename: filename ?? null,
        mimeType,
        base64Len: base64.length,
        status: res.status,
        statusText: res.statusText,
        body: errBody.slice(0, 500),
      })
      return ''
    }
    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    if (!text.trim()) {
      console.error('[foundation-ingest-diag] extractImageText: Anthropic 200 but empty text', {
        filename: filename ?? null,
        mimeType,
        base64Len: base64.length,
        stopReason: data.stop_reason ?? null,
        contentBlocks: Array.isArray(data.content) ? data.content.length : 0,
      })
    }
    return text
  } catch (err) {
    console.error('[foundation-ingest-diag] extractImageText: fetch threw', {
      filename: filename ?? null,
      base64Len: base64.length,
      error: err instanceof Error ? err.message : String(err),
    })
    return ''
  }
}

// ── Field mapping via Claude ───────────────────────────────────────────────────

const FIELD_DESCRIPTIONS = `
Foundation fields to extract (use these exact key names):
- businessDescription: What the business does
- problemSolved: The problem it solves for customers
- transformation: The transformation/outcome it delivers
- customerWho: Who the ideal customer is
- customerFrustration: What frustrates the customer
- customerTriedBefore: What the customer has tried before
- customerBuyingTrigger: What triggers the customer to buy
- competitors: Array of competitor names (strings)
- differentiator: How the business is different
- differentiatorOwn: The differentiator in the owner's own words
- toneTraits: Array of brand voice traits (e.g. "direct", "warm")
- brandsAdmired: Brand names admired for communication style
- neverSoundLike: Brands/styles to avoid sounding like
- marketingBudget: Monthly marketing budget
- channels: Array of marketing/sales channels
- monthlyGoal: Primary goal for the next 30 days
`

export async function interpretExtraction(
  text: string,
  source: string,
): Promise<ExtractionResult> {
  if (!text.trim()) {
    console.error('[foundation-ingest-diag] interpretExtraction: empty raw text → "No readable content found."', {
      source,
      textLen: text.length,
    })
    return { items: [], summary: 'No readable content found.' }
  }

  const prompt = `You are analyzing a business document to extract information that maps to Foundation profile fields.

${FIELD_DESCRIPTIONS}

Document content (first 3000 chars):
${text.slice(0, 3000)}

Return a JSON object with this exact shape:
{
  "items": [
    {
      "field": "fieldName",
      "value": "extracted value or array",
      "confidence": "high|medium|low",
      "question": "optional clarifying question if uncertain"
    }
  ],
  "summary": "one sentence summary of what was found"
}

Rules:
- Only include fields where you found clear evidence in the document
- For array fields (competitors, toneTraits, channels), value must be a JSON array
- confidence "high" = explicitly stated; "medium" = clearly implied; "low" = uncertain
- If a field is ambiguous, include it with confidence "low" and add a question
- Never infer Voice (toneTraits etc.) or Budget from a website URL source
- Return valid JSON only, no markdown`

  // Same Haiku slug as foundation/score, brand-kit, digest, runLightAgent — verified on OpenRouter.
  const FIELD_MAPPING_MODEL = 'anthropic/claude-haiku-4-5'

  let content: string
  try {
    const res = await openRouterComplete({
      model: FIELD_MAPPING_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.1,
    })
    content = res.content
  } catch (err) {
    console.error('[foundation-ingest-diag] interpretExtraction: OpenRouter call failed', {
      source,
      textLen: text.length,
      model: FIELD_MAPPING_MODEL,
      error: err instanceof Error ? err.message : String(err),
    })
    return { items: [], summary: "Couldn't reach the analysis model." }
  }

  try {
    const raw = content.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(raw) as { items: Omit<ExtractionItem, 'source'>[]; summary: string }

    const items: ExtractionItem[] = (parsed.items ?? []).map(item => ({
      ...item,
      source,
    }))

    return { items, summary: parsed.summary ?? `Extracted ${items.length} Foundation fields.` }
  } catch (err) {
    console.error('[foundation-ingest-diag] interpretExtraction: JSON parse failed', {
      source,
      textLen: text.length,
      model: FIELD_MAPPING_MODEL,
      contentPreview: content.slice(0, 300),
      error: err instanceof Error ? err.message : String(err),
    })
    return { items: [], summary: 'Model returned an unreadable response.' }
  }
}
