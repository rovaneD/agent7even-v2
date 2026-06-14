/** Extract display/summary text from agent_outputs.content (string or { raw, parsed }). */
export function agentOutputContentText(content: unknown): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (typeof content === 'object' && content !== null) {
    const obj = content as { raw?: unknown; parsed?: unknown }
    if (typeof obj.raw === 'string') return obj.raw
    if (obj.parsed != null) {
      if (typeof obj.parsed === 'string') return obj.parsed
      return JSON.stringify(obj.parsed, null, 2)
    }
    return JSON.stringify(content, null, 2)
  }
  return String(content)
}
