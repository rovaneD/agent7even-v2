import type { UIMessage } from 'ai'

/** Keep the last occurrence of each message id so completed streamed content wins. */
export function dedupeMessagesById<T extends { id: string }>(messages: T[]): T[] {
  const byId = new Map<string, T>()
  for (const message of messages) byId.set(message.id, message)
  return Array.from(byId.values())
}

/** Build the transcript to persist after a stream finishes. */
export function messagesForPersist(messages: UIMessage[], finished: UIMessage): UIMessage[] {
  const merged = messages.map(message => (message.id === finished.id ? finished : message))
  if (!messages.some(message => message.id === finished.id)) merged.push(finished)
  return dedupeMessagesById(merged)
}
