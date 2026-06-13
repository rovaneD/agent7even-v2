/** Split Email Sequence Builder markdown into copy-friendly blocks. */

export type EmailSequenceField = {
  id: 'send' | 'subject' | 'altSubject' | 'preview' | 'body' | 'cta'
  label: string
  value: string
  multiline?: boolean
}

export type ParsedSequenceEmail = {
  number: string
  heading: string
  text: string
  fields: EmailSequenceField[]
}

export type ParsedEmailSequence = {
  intro: string
  emails: ParsedSequenceEmail[]
  footer: string
}

function extractLabeledValue(text: string, label: string): string | null {
  const pattern = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+?)(?=\\n|$)`, 'i')
  const match = text.match(pattern)
  return match?.[1]?.trim() ?? null
}

function extractBodyCopy(text: string): string {
  const bodyStart = text.search(/\*\*Body Copy:\*\*/i)
  if (bodyStart < 0) return ''

  const start = text.indexOf('\n', bodyStart)
  if (start < 0) return ''

  const bodyEnd = text.search(/\*\*CTA:\*\*/i)
  const raw = bodyEnd > start ? text.slice(start + 1, bodyEnd) : text.slice(start + 1)
  return raw.trim()
}

export function parseEmailFields(text: string): EmailSequenceField[] {
  const fields: EmailSequenceField[] = []

  const send = extractLabeledValue(text, 'Send')
  if (send) fields.push({ id: 'send', label: 'Send timing', value: send })

  const subject = extractLabeledValue(text, 'Subject')
  if (subject) fields.push({ id: 'subject', label: 'Subject line', value: subject })

  const altSubject = extractLabeledValue(text, 'Alt Subject')
  if (altSubject) fields.push({ id: 'altSubject', label: 'Alt subject', value: altSubject })

  const preview = extractLabeledValue(text, 'Preview Text')
  if (preview) fields.push({ id: 'preview', label: 'Preview text', value: preview })

  const body = extractBodyCopy(text)
  if (body) fields.push({ id: 'body', label: 'Body copy', value: body, multiline: true })

  const cta = extractLabeledValue(text, 'CTA')
  if (cta) fields.push({ id: 'cta', label: 'CTA', value: cta })

  return fields
}

export function parseEmailSequenceMarkdown(content: string): ParsedEmailSequence | null {
  const normalized = content.replace(/\r\n/g, '\n').trim()
  if (!/##\s*EMAIL\s+\d+/i.test(normalized)) return null

  const complianceMatch = normalized.match(/\n##\s*Compliance Notes/i)
  const main = complianceMatch?.index != null
    ? normalized.slice(0, complianceMatch.index).trim()
    : normalized
  const footer = complianceMatch?.index != null
    ? normalized.slice(complianceMatch.index).trim()
    : ''

  const firstEmailIdx = main.search(/##\s*EMAIL\s+\d+/i)
  const intro = firstEmailIdx > 0 ? main.slice(0, firstEmailIdx).trim() : ''
  const emailBody = firstEmailIdx >= 0 ? main.slice(firstEmailIdx).trim() : main

  const chunks = emailBody.split(/(?=##\s*EMAIL\s+\d+)/i).filter(Boolean)
  const emails: ParsedSequenceEmail[] = []

  for (const chunk of chunks) {
    const match = chunk.match(/^##\s*EMAIL\s+(\d+):\s*([^\n]+)\n([\s\S]*)$/i)
    if (!match) continue
    const text = chunk.trim()
    emails.push({
      number: match[1],
      heading: match[2].trim(),
      text,
      fields: parseEmailFields(text),
    })
  }

  if (emails.length === 0) return null
  return { intro, emails, footer }
}

/** Plain-text bundle for pasting all ESP fields at once. */
export function emailPasteBlock(email: ParsedSequenceEmail): string {
  const labelMap: Record<EmailSequenceField['id'], string> = {
    send: 'Send timing',
    subject: 'Subject',
    altSubject: 'Alt subject',
    preview: 'Preview text',
    body: 'Body',
    cta: 'CTA',
  }

  const lines: string[] = []
  for (const field of email.fields) {
    if (field.id === 'body') {
      lines.push('', `${labelMap[field.id]}:`, field.value, '')
    } else {
      lines.push(`${labelMap[field.id]}: ${field.value}`)
    }
  }

  if (lines.length === 0) return email.text
  return lines.join('\n').trim()
}
