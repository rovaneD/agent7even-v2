import type { FoundationContext } from '@/lib/agents/loadFoundationContext'

export type InboxDraftThreadMessage = {
  direction: 'incoming' | 'outgoing'
  text: string
  senderName?: string
}

export type InboxDraftReplyInput = {
  channel: 'dm' | 'comment'
  platform: string
  companyName?: string | null
  participantName?: string | null
  postPreview?: string | null
  replyToComment?: string | null
  threadMessages: InboxDraftThreadMessage[]
  foundation: FoundationContext
}

function foundationVoiceSnippet(foundation: FoundationContext): string {
  const voice = foundation.documents.voice.trim()
  if (voice) return voice.slice(0, 1200)
  const tone = foundation.answers.tone ?? foundation.answers.brand_voice ?? ''
  return tone.slice(0, 600)
}

export function buildInboxDraftReplyPrompt(input: InboxDraftReplyInput): {
  system: string
  userMessage: string
} {
  const voice = foundationVoiceSnippet(input.foundation)
  const company = input.companyName?.trim() || 'the business'

  const system = `You draft short social inbox replies for ${company}.
Write ONE reply the user can send as-is. Match the brand voice when provided.
Rules:
- Plain text only — no markdown, no emoji, no hashtags unless clearly on-brand.
- 1–3 sentences for DMs; 1–2 sentences for public post comments.
- Warm, direct, helpful. Never mention AI, agents, or internal tools.
- Do not invent offers, prices, or policies not implied by the thread.
${voice ? `\nBrand voice reference:\n${voice}` : ''}`

  const threadLines = input.threadMessages
    .slice(-12)
    .map(msg => {
      const who = msg.senderName?.trim()
        || (msg.direction === 'outgoing' ? 'You' : input.participantName?.trim() || 'Contact')
      return `${who}: ${msg.text.trim()}`
    })
    .filter(line => line.length > 3)

  const contextParts = [
    `Channel: ${input.channel === 'dm' ? 'Direct message' : 'Public post comment'}`,
    `Platform: ${input.platform}`,
  ]
  if (input.participantName) contextParts.push(`Contact: ${input.participantName}`)
  if (input.postPreview) contextParts.push(`Post: ${input.postPreview.slice(0, 280)}`)
  if (input.replyToComment) contextParts.push(`Replying to comment: ${input.replyToComment.slice(0, 280)}`)

  const userMessage = `${contextParts.join('\n')}

Recent thread:
${threadLines.join('\n') || '(no prior messages)'}

Write the next reply only — no preamble.`

  return { system, userMessage }
}
