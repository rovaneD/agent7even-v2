/** Shared Voix (AI receptionist) types and labels. Mirrors 46_voix_core.sql. */

export const VOIX_OUTCOMES = [
  'booked',
  'rescheduled',
  'cancelled',
  'question_answered',
  'callback_needed',
  'clinical',
  'complaint',
  'spam',
  'hang_up',
  'other',
] as const
export type VoixOutcome = (typeof VOIX_OUTCOMES)[number]

export const OUTCOME_LABELS: Record<VoixOutcome, string> = {
  booked: 'Booked',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  question_answered: 'Question answered',
  callback_needed: 'Callback needed',
  clinical: 'Clinical, to provider',
  complaint: 'Complaint',
  spam: 'Spam or wrong number',
  hang_up: 'Hang-up',
  other: 'Other',
}

/** Tailwind classes for outcome badges. */
export const OUTCOME_TONE: Record<VoixOutcome, string> = {
  booked: 'bg-[#E7F6EE] text-[#17663F]',
  rescheduled: 'bg-[#E7F6EE] text-[#17663F]',
  cancelled: 'bg-[#F2F3F6] text-[#4A5061]',
  question_answered: 'bg-[#EAF0FF] text-[#2A47B8]',
  callback_needed: 'bg-[#FFF4E0] text-[#8A5A00]',
  clinical: 'bg-[#FDECEC] text-[#A12B2B]',
  complaint: 'bg-[#FDECEC] text-[#A12B2B]',
  spam: 'bg-[#F2F3F6] text-[#5B6070]',
  hang_up: 'bg-[#F2F3F6] text-[#5B6070]',
  other: 'bg-[#F2F3F6] text-[#4A5061]',
}

export const FOLLOWUP_REASONS = [
  'callback_needed',
  'clinical',
  'complaint',
  'booking_failed',
  'urgent',
  'other',
] as const
export type VoixFollowupReason = (typeof FOLLOWUP_REASONS)[number]

export const REASON_LABELS: Record<VoixFollowupReason, string> = {
  callback_needed: 'Wants a callback',
  clinical: 'Clinical question',
  complaint: 'Complaint',
  booking_failed: 'Booking not finished',
  urgent: 'Urgent',
  other: 'Needs a person',
}

export const DONE_REASONS = ['booked', 'resolved', 'no_answer', 'not_interested', 'spam', 'other'] as const
export type VoixDoneReason = (typeof DONE_REASONS)[number]

export const DONE_REASON_LABELS: Record<VoixDoneReason, string> = {
  booked: 'Booked',
  resolved: 'Resolved',
  no_answer: 'No answer, gave up',
  not_interested: 'Not interested',
  spam: 'Spam',
  other: 'Other',
}

export const SNOOZE_PRESETS = ['1h', '3h', 'tomorrow_9am', 'next_week'] as const
export type VoixSnoozePreset = (typeof SNOOZE_PRESETS)[number]

export const SNOOZE_LABELS: Record<VoixSnoozePreset, string> = {
  '1h': 'In 1 hour',
  '3h': 'In 3 hours',
  tomorrow_9am: 'Tomorrow 9am',
  next_week: 'Next Monday 9am',
}

export type VoixAccount = {
  id: string
  name: string
  timezone: string
  retell_agent_ids: string[]
  phone_number: string | null
  transfer_number: string | null
  alert_emails: string[]
  status: 'pilot' | 'active' | 'paused'
  created_at: string
}

export type VoixMember = {
  id: string
  account_id: string
  email: string
  full_name: string | null
  clerk_user_id: string | null
  role: 'owner' | 'staff'
  invited_at: string
  joined_at: string | null
}

export type VoixTranscriptTurn = { role: string; content: string }

export type VoixCall = {
  id: string
  account_id: string
  retell_call_id: string
  agent_id: string | null
  direction: 'inbound' | 'outbound' | 'web'
  status: 'ongoing' | 'ended' | 'analyzed'
  from_number: string | null
  to_number: string | null
  caller_name: string | null
  started_at: string | null
  ended_at: string | null
  duration_sec: number | null
  disconnection_reason: string | null
  recording_url: string | null
  transcript: string | null
  transcript_object: VoixTranscriptTurn[] | null
  summary: string | null
  outcome: VoixOutcome | null
  sentiment: string | null
  urgent: boolean
  treatment_interest: string | null
  is_sample: boolean
  created_at: string
}

export type VoixFollowup = {
  id: string
  account_id: string
  call_id: string
  reason: VoixFollowupReason
  priority: 'urgent' | 'normal'
  status: 'open' | 'snoozed' | 'done'
  assigned_member_id: string | null
  snoozed_until: string | null
  done_reason: VoixDoneReason | null
  done_at: string | null
  done_by_member_id: string | null
  created_at: string
  updated_at: string
}

export type VoixFollowupEvent = {
  id: string
  followup_id: string
  member_id: string | null
  actor_label: string | null
  type: 'created' | 'note' | 'called' | 'assigned' | 'snoozed' | 'reopened' | 'done'
  body: string | null
  created_at: string
}

export const CALL_LIST_SELECT =
  'id, account_id, retell_call_id, direction, status, from_number, caller_name, started_at, duration_sec, summary, outcome, urgent, treatment_interest, is_sample'
