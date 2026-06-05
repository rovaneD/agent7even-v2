import Exa, { type DeepSearchOutputGrounding } from 'exa-js'

function getExa(): Exa | null {
  const key = process.env.EXA_API_KEY
  if (!key) return null
  return new Exa(key)
}

export type ExaSiteRead = {
  url: string
  title?: string
  text?: string
}

export type ExaCompetitor = {
  url: string
  title?: string
  highlights?: string[]
}

export type FoundationSuggestions = {
  businessDescription?: string | null
  problemSolved?: string | null
  transformation?: string | null
  customerWho?: string | null
  competitors?: string[]
  differentiatorOwn?: string | null
}

export type ExaGrounding = DeepSearchOutputGrounding

// Read the user's own website. /contents options are TOP-LEVEL on getContents.
export async function exaReadSite(url: string): Promise<ExaSiteRead | null> {
  const exa = getExa()
  if (!exa) return null
  try {
    const res = await exa.getContents([url], {
      text: { maxCharacters: 4000, verbosity: 'compact' },
    })
    const first = res?.results?.[0]
    if (!first) return null
    return {
      url: first.url,
      title: first.title ?? undefined,
      text: first.text ?? undefined,
    }
  } catch {
    return null
  }
}

// Find competitors via search. On /search, options nest inside `contents`.
// Retained for future agent use — not called in the foundation research route (Approach A).
export async function exaFindCompetitors(
  seed: string,
  numResults = 5
): Promise<ExaCompetitor[]> {
  const exa = getExa()
  if (!exa) return []
  try {
    const res = await exa.searchAndContents(`competitors of ${seed}`, {
      type: 'auto',
      numResults,
      highlights: true,
    })
    return (res?.results ?? []).map((r) => ({
      url: r.url,
      title: r.title ?? undefined,
      highlights: r.highlights ?? undefined,
    }))
  } catch {
    return []
  }
}

// Synthesize Foundation fields from web search using Exa outputSchema.
// One call: Exa searches + synthesizes into structured JSON with field-level confidence.
// Voice (toneTraits etc.) and Budget/Goals are intentionally excluded from the schema.
export async function exaSynthesizeFoundation(
  seed: string,
  siteContext?: string | null
): Promise<{ suggestions: FoundationSuggestions; grounding: ExaGrounding[] } | null> {
  const exa = getExa()
  if (!exa) return null
  try {
    const systemPromptParts = [
      'Extract business information for the given business from its official website and public sources.',
      'Prefer the official business website over third-party sources.',
      'Leave fields null when the information is unknown, uncertain, or not clearly stated.',
      'For competitors, return at most 3 well-known direct competitors by name only.',
    ]
    if (siteContext) {
      systemPromptParts.push(`Site content: ${siteContext.slice(0, 800)}`)
    }

    const res = await exa.search(seed, {
      type: 'auto',
      numResults: 5,
      systemPrompt: systemPromptParts.join(' '),
      outputSchema: {
        type: 'object',
        properties: {
          businessDescription: { type: 'string' },
          problemSolved: { type: 'string' },
          transformation: { type: 'string' },
          customerWho: { type: 'string' },
          competitors: { type: 'array', items: { type: 'string' } },
          differentiatorOwn: { type: 'string' },
        },
      },
      contents: { text: { maxCharacters: 2000 } },
    })

    if (!res.output?.content || typeof res.output.content !== 'object') return null

    return {
      suggestions: res.output.content as FoundationSuggestions,
      grounding: res.output.grounding ?? [],
    }
  } catch {
    return null
  }
}
