/** Strip provider / infra details before showing errors in the product UI. */

const PROVIDER_MARKERS = [
  'openrouter',
  'openrouter.ai',
  '"error":',
  'error 402',
  'error 401',
  'error 403',
  'error 429',
  'error 500',
  'error 502',
  'error 503',
  'insufficient credits',
  'rate limit',
  'api key',
]

export type UserErrorContext =
  | 'image_generation'
  | 'image_edit'
  | 'image_qa'
  | 'image_regenerate'
  | 'video_generation'
  | 'agent'
  | 'chat'

const DEFAULT_BY_CONTEXT: Record<UserErrorContext, string> = {
  image_generation: 'We couldn\'t generate images right now. Please try again in a few minutes.',
  image_edit: 'We couldn\'t apply that edit right now. Please try again in a few minutes.',
  image_qa: 'Text check couldn\'t run right now. Please try again in a few minutes.',
  image_regenerate: 'We couldn\'t regenerate that option right now. Please try again in a few minutes.',
  video_generation: 'We couldn\'t start your video right now. Please try again in a few minutes.',
  agent: 'This run couldn\'t complete right now. Please try again in a few minutes.',
  chat: 'Maya couldn\'t respond right now. Please try again in a few minutes.',
}

const UNAVAILABLE =
  'Image generation is temporarily unavailable. Please try again in a few minutes.'

/** Safe app-authored messages we intentionally show verbatim. */
const ALLOWLIST_SUBSTRINGS = [
  'choose a post goal',
  'foundation',
  'strengthen your foundation',
  'text qa failed',
  'regenerate this option',
  'maximum',
  'pick a generated image',
  'select an image option',
  'post goal required',
  'image is too large',
  'wait for text qa',
  'video is generating',
  'ready to review',
  'top up your credits',
  'requires more credits',
]

function looksLikeProviderLeak(raw: string): boolean {
  const lower = raw.toLowerCase()
  if (PROVIDER_MARKERS.some(marker => lower.includes(marker))) return true
  if (/^\s*\{/.test(raw) || /"\w+"\s*:\s*\{/.test(raw)) return true
  if (/error \d{3}:/i.test(raw)) return true
  if (raw.length > 140) return true
  return false
}

function isAllowlisted(raw: string): boolean {
  const lower = raw.toLowerCase()
  return ALLOWLIST_SUBSTRINGS.some(part => lower.includes(part))
}

export function sanitizeUserFacingError(
  raw: string | undefined | null,
  context: UserErrorContext = 'agent',
): string {
  const message = raw?.trim()
  if (!message) return DEFAULT_BY_CONTEXT[context]

  if (isAllowlisted(message) && !looksLikeProviderLeak(message)) {
    return message
  }

  const lower = message.toLowerCase()
  if (
    lower.includes('insufficient credits')
    || lower.includes('error 402')
    || lower.includes('"code":402')
  ) {
    return context.startsWith('image') ? UNAVAILABLE : DEFAULT_BY_CONTEXT[context]
  }

  if (lower.includes('429') || lower.includes('rate limit')) {
    return 'Too many requests right now. Please wait a moment and try again.'
  }

  if (looksLikeProviderLeak(message)) {
    return DEFAULT_BY_CONTEXT[context]
  }

  return message
}

export function logProviderError(scope: string, err: unknown): void {
  console.error(`[${scope}]`, err)
}
