import type { GeneratedImageOption, TextQaResult } from './types'

const SESSION_VERSION = 1

export type StoredGenerationOption = Omit<GeneratedImageOption, 'previewUrl'> & {
  previewUrl?: string | null
}

export type GenerationSession = {
  version: typeof SESSION_VERSION
  briefId: string
  imageModelLabel: string | null
  imageModelId?: string | null
  options: StoredGenerationOption[]
  selectedIndex: number | null
  generatedTextQa: TextQaResult | null
  qaRetryByIndex: Record<number, number>
  contentPostingForm: Record<string, string>
  taskInstructions: string
  savedAt: string
}

function storageKey(profileId: string): string {
  return `agent7even:gen-session:${profileId}`
}

export function loadGenerationSession(profileId: string): GenerationSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey(profileId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as GenerationSession
    if (parsed.version !== SESSION_VERSION) return null
    if (!parsed.briefId || !Array.isArray(parsed.options) || parsed.options.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

export function saveGenerationSession(profileId: string, session: Omit<GenerationSession, 'version' | 'savedAt'>): void {
  if (typeof window === 'undefined') return
  const payload: GenerationSession = {
    version: SESSION_VERSION,
    ...session,
    options: session.options.map(({ previewUrl: _preview, ...rest }) => rest),
    savedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(storageKey(profileId), JSON.stringify(payload))
  } catch {
    // Quota or private mode — ignore
  }
}

export function clearGenerationSession(profileId: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(storageKey(profileId))
  } catch {
    // ignore
  }
}
