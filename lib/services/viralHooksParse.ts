/** Split Viral Hooks generated markdown into copy-friendly blocks. */

export type ParsedViralHook = {
  label: string
  text: string
  format?: string
  rationale?: string
}

export type ParsedHookFamily = {
  title: string
  blurb: string
  hooks: ParsedViralHook[]
}

export type ParsedViralHooksOutput = {
  title: string
  intro: string
  families: ParsedHookFamily[]
  footer: string
}

const FAMILY_SECTION = /^##\s*\d+\.\s*.+HOOKS/im

function parseHookBlock(chunk: string): ParsedViralHook | null {
  const labelMatch = chunk.match(/^###\s*(Hook\s*[\d.]+[^\n]*)/im)
  const label = labelMatch?.[1]?.trim() ?? 'Hook'

  const quoted = chunk.match(/\*\*"([^"]+)"\*\*/)
  const bold = chunk.match(/\*\*([^*\n]+)\*\*/)
  const text = (quoted?.[1] ?? bold?.[1])?.trim()
  if (!text) return null

  const formatMatch =
    chunk.match(/\*Format:\*\*\s*(.+?)(?:\n|$)/i)
    ?? chunk.match(/-\s*\*Format:\*\*\s*(.+?)(?:\n|$)/i)
  const format = formatMatch?.[1]?.trim()

  const rationaleMatch = chunk.match(/\*Why it works:\*\*\s*([\s\S]+?)(?=\n###|\n##|$)/i)
  const rationale = rationaleMatch?.[1]?.trim().replace(/\s+/g, ' ')

  return { label, text, format, rationale }
}

function parseFamilyChunk(chunk: string): ParsedHookFamily | null {
  const titleMatch = chunk.match(/^##\s*(?:\d+\.\s*)?(.+)$/im)
  if (!titleMatch) return null

  const parts = chunk.split(/(?=^###\s*Hook\s)/im).filter(Boolean)
  const header = parts[0] ?? chunk
  const hookChunks = parts.slice(1)

  const blurb = header
    .replace(/^##\s*(?:\d+\.\s*)?.+\n+/im, '')
    .replace(/^---\s*\n+/m, '')
    .trim()

  const hooks = hookChunks
    .map(parseHookBlock)
    .filter((hook): hook is ParsedViralHook => hook != null)

  if (hooks.length === 0) return null

  return {
    title: titleMatch[1].trim(),
    blurb,
    hooks,
  }
}

export function parseViralHooksMarkdown(content: string): ParsedViralHooksOutput | null {
  const normalized = content.replace(/\r\n/g, '\n').trim()
  if (!normalized) return null

  const familyStart = normalized.search(FAMILY_SECTION)
  if (familyStart < 0) return null

  const titleMatch = normalized.match(/^#\s*(.+?)(?:\n|$)/)
  const title = titleMatch?.[1]?.trim() ?? 'Viral Hooks'

  const introEnd = familyStart
  const intro = normalized
    .slice(titleMatch ? normalized.indexOf('\n', normalized.indexOf('#')) + 1 : 0, introEnd)
    .replace(/^---\s*\n+/m, '')
    .trim()

  const body = normalized.slice(familyStart)
  const footerMatch = body.search(/^##\s*(?:STRONGEST|TOP\s*5)/im)
  const familiesText = footerMatch >= 0 ? body.slice(0, footerMatch).trim() : body.trim()
  const footer = footerMatch >= 0 ? body.slice(footerMatch).trim() : ''

  const families = familiesText
    .split(/(?=^##\s*\d+\.)/m)
    .map(parseFamilyChunk)
    .filter((family): family is ParsedHookFamily => family != null)

  if (families.length === 0) return null

  return { title, intro, families, footer }
}

export function viralHookCopyText(hook: ParsedViralHook): string {
  const lines = [hook.text]
  if (hook.format) lines.push(`Format: ${hook.format}`)
  return lines.join('\n')
}
