export type IdeaAnalysis = {
  topic: string
  idea_seed: string
  unique_angle: string
  belief_to_challenge: string
  contrarian_reality: string
  supporting_evidence: [string, string, string]
  source_ref: string
}

export function stripJsonFence(raw: string): string {
  const trimmed = raw.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  return fenceMatch ? fenceMatch[1].trim() : trimmed
}

export function parseIdeaAnalysisJson(raw: string): unknown {
  return JSON.parse(stripJsonFence(raw))
}

export function validateIdeaAnalysis(
  value: unknown,
): { ok: true; data: IdeaAnalysis } | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Output must be a JSON object.' }
  }

  const obj = value as Record<string, unknown>
  const requiredStrings = [
    'topic',
    'idea_seed',
    'unique_angle',
    'belief_to_challenge',
    'contrarian_reality',
    'source_ref',
  ] as const

  for (const key of requiredStrings) {
    if (typeof obj[key] !== 'string' || !obj[key].trim()) {
      return { ok: false, error: `Missing or invalid field: ${key}` }
    }
  }

  if (!Array.isArray(obj.supporting_evidence) || obj.supporting_evidence.length !== 3) {
    return { ok: false, error: 'supporting_evidence must be an array of exactly 3 strings.' }
  }

  const evidence = obj.supporting_evidence.map((item, index) => {
    if (typeof item !== 'string' || !item.trim()) {
      return { ok: false as const, error: `supporting_evidence[${index}] must be a non-empty string.` }
    }
    return { ok: true as const, value: item.trim() }
  })

  for (const item of evidence) {
    if (!item.ok) return { ok: false, error: item.error }
  }

  return {
    ok: true,
    data: {
      topic: String(obj.topic).trim(),
      idea_seed: String(obj.idea_seed).trim(),
      unique_angle: String(obj.unique_angle).trim(),
      belief_to_challenge: String(obj.belief_to_challenge).trim(),
      contrarian_reality: String(obj.contrarian_reality).trim(),
      supporting_evidence: evidence.map(item => item.value!) as [string, string, string],
      source_ref: String(obj.source_ref).trim(),
    },
  }
}

export function parseAndValidateIdeaAnalysis(
  raw: string,
): { ok: true; data: IdeaAnalysis } | { ok: false; error: string } {
  try {
    return validateIdeaAnalysis(parseIdeaAnalysisJson(raw))
  } catch {
    return { ok: false, error: 'Output is not valid JSON.' }
  }
}

/** Read validated analysis from agent_outputs.content ({ parsed } or { raw }). */
export function readIdeaAnalysisFromContent(
  content: unknown,
): IdeaAnalysis | null {
  if (!content || typeof content !== 'object') return null
  const obj = content as { parsed?: unknown; raw?: unknown }
  if (obj.parsed) {
    const fromParsed = validateIdeaAnalysis(obj.parsed)
    if (fromParsed.ok) return fromParsed.data
  }
  if (typeof obj.raw === 'string' && obj.raw.trim()) {
    const fromRaw = parseAndValidateIdeaAnalysis(obj.raw)
    if (fromRaw.ok) return fromRaw.data
  }
  return null
}
