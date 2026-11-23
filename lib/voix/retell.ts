import { createHmac, timingSafeEqual } from 'node:crypto'
import { VOIX_OUTCOMES, type VoixOutcome, type VoixTranscriptTurn } from '@/lib/voix/types'

/**
 * Verify Retell's `x-retell-signature` header: "v={unix_ms},d={hex}".
 * d = HMAC-SHA256(rawBody + v) keyed with the Retell API key that has the
 * webhook badge. Rejects signatures older than 5 minutes.
 */
export function verifyRetellSignature(
  rawBody: string,
  header: string | null,
  apiKey: string,
  now = Date.now(),
): boolean {
  if (!header || !apiKey) return false
  const match = /^v=(\d+),d=([0-9a-f]+)$/i.exec(header.trim())
  if (!match) return false
  const [, timestamp, digest] = match
  if (Math.abs(now - Number(timestamp)) > 5 * 60 * 1000) return false
  const expected = createHmac('sha256', apiKey).update(rawBody + timestamp).digest()
  const given = Buffer.from(digest, 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export type RetellEvent = 'call_started' | 'call_ended' | 'call_analyzed' | string

/** The subset of Retell's call object Voix reads. Every field is optional on purpose. */
export type RetellCall = {
  call_id?: string
  agent_id?: string
  call_type?: string
  direction?: string
  from_number?: string
  to_number?: string
  start_timestamp?: number
  end_timestamp?: number
  duration_ms?: number
  disconnection_reason?: string
  recording_url?: string
  transcript?: string
  transcript_object?: { role?: string; content?: string }[]
  retell_llm_dynamic_variables?: Record<string, unknown>
  metadata?: Record<string, unknown>
  call_analysis?: {
    call_summary?: string
    user_sentiment?: string
    call_successful?: boolean
    in_voicemail?: boolean
    custom_analysis_data?: Record<string, unknown>
  }
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return ['true', 'yes', '1'].includes(v.trim().toLowerCase())
  return false
}

const OUTCOME_ALIASES: Record<string, VoixOutcome> = {
  booking: 'booked',
  appointment_booked: 'booked',
  reschedule: 'rescheduled',
  cancel: 'cancelled',
  canceled: 'cancelled',
  question: 'question_answered',
  faq: 'question_answered',
  answered: 'question_answered',
  callback: 'callback_needed',
  call_back: 'callback_needed',
  medical: 'clinical',
  provider: 'clinical',
  wrong_number: 'spam',
  hangup: 'hang_up',
  hung_up: 'hang_up',
}

export function normalizeOutcome(v: unknown): VoixOutcome | null {
  const raw = str(v)
  if (!raw) return null
  const key = raw.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '')
  if ((VOIX_OUTCOMES as readonly string[]).includes(key)) return key as VoixOutcome
  return OUTCOME_ALIASES[key] ?? 'other'
}

function iso(ms: number | undefined): string | null {
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

export type MappedCall = {
  retell_call_id: string
  agent_id: string | null
  direction: 'inbound' | 'outbound' | 'web'
  from_number: string | null
  to_number: string | null
  started_at: string | null
  ended_at: string | null
  duration_sec: number | null
  disconnection_reason: string | null
  recording_url: string | null
  transcript: string | null
  transcript_object: VoixTranscriptTurn[] | null
  // Analysis fields (only set on call_analyzed)
  summary?: string | null
  outcome?: VoixOutcome | null
  sentiment?: string | null
  urgent?: boolean
  caller_name?: string | null
  treatment_interest?: string | null
  analysis?: Record<string, unknown> | null
}

export type FollowupSignal = { needed: boolean; reasonText: string | null }

/**
 * Map a Retell call to voix_calls columns. Custom post-call analysis fields we
 * configure on the agent: outcome, caller_name, urgent, needs_followup,
 * followup_reason, treatment_interest.
 */
export function mapRetellCall(call: RetellCall, withAnalysis: boolean): { row: MappedCall; followup: FollowupSignal } {
  const direction =
    call.call_type === 'web_call' ? 'web' : call.direction === 'outbound' ? 'outbound' : 'inbound'
  const durationMs =
    typeof call.duration_ms === 'number'
      ? call.duration_ms
      : call.start_timestamp && call.end_timestamp
        ? call.end_timestamp - call.start_timestamp
        : null

  const turns = Array.isArray(call.transcript_object)
    ? call.transcript_object
        .filter((t) => typeof t?.content === 'string' && t.content.trim())
        .map((t) => ({ role: t.role === 'agent' ? 'agent' : 'user', content: String(t.content).trim() }))
    : null

  const row: MappedCall = {
    retell_call_id: String(call.call_id),
    agent_id: str(call.agent_id),
    direction,
    from_number: str(call.from_number),
    to_number: str(call.to_number),
    started_at: iso(call.start_timestamp),
    ended_at: iso(call.end_timestamp),
    duration_sec: durationMs != null ? Math.max(0, Math.round(durationMs / 1000)) : null,
    disconnection_reason: str(call.disconnection_reason),
    recording_url: str(call.recording_url),
    transcript: str(call.transcript),
    transcript_object: turns && turns.length ? turns : null,
  }

  if (!withAnalysis) return { row, followup: { needed: false, reasonText: null } }

  const analysis = call.call_analysis ?? {}
  const custom = analysis.custom_analysis_data ?? {}
  let outcome = normalizeOutcome(custom.outcome)
  if (!outcome) {
    const short = (row.duration_sec ?? 0) < 10 && !(row.transcript_object?.some((t) => t.role === 'user'))
    outcome = short ? 'hang_up' : 'other'
  }

  row.summary = str(analysis.call_summary)
  row.outcome = outcome
  row.sentiment = str(analysis.user_sentiment)
  row.urgent = bool(custom.urgent)
  row.caller_name = str(custom.caller_name)
  row.treatment_interest = str(custom.treatment_interest)
  row.analysis = { ...analysis } as Record<string, unknown>

  const needed =
    bool(custom.needs_followup) ||
    row.urgent === true ||
    outcome === 'callback_needed' ||
    outcome === 'clinical' ||
    outcome === 'complaint'

  return { row, followup: { needed, reasonText: str(custom.followup_reason) } }
}
