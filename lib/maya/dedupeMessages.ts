import type { UIMessage } from 'ai'

/** Keep first occurrence of each message id — fixes duplicate saves from onFinish races. */
export function dedupeMessagesById<T extends { id: string }>(messages: T[]): T[] {
  const seen = new Set<string>()
  return messages.filter(m => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}

/** Build the transcript to persist after a stream finishes. */
export function messagesForPersist(messages: UIMessage[], finished: UIMessage): UIMessage[] {
  const includesFinished = messages.some(m => m.id === finished.id)
  return dedupeMessagesById(includesFinished ? messages : [...messages, finished])
}
