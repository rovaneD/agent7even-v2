export const PROSPECT_STATUSES = ['to_contact', 'contacted', 'replied', 'demo', 'pilot', 'not_interested'] as const
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number]

export const PROSPECT_STATUS_LABEL: Record<ProspectStatus, string> = {
  to_contact: 'To contact',
  contacted: 'Contacted',
  replied: 'Replied',
  demo: 'Demo booked',
  pilot: 'In pilot',
  not_interested: 'Not interested',
}

export const PROSPECT_CHANNELS = ['ig_dm', 'email', 'in_person', 'phone', 'other'] as const
export type ProspectChannel = (typeof PROSPECT_CHANNELS)[number]

export const PROSPECT_CHANNEL_LABEL: Record<ProspectChannel, string> = {
  ig_dm: 'Instagram DM',
  email: 'Email',
  in_person: 'In person',
  phone: 'Phone',
  other: 'Other',
}

export type VoixProspect = {
  id: string
  spa_name: string
  website: string | null
  instagram: string | null
  city: string | null
  contact_name: string | null
  channel: ProspectChannel
  status: ProspectStatus
  last_contacted_at: string | null
  next_follow_up: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export const PROSPECT_SELECT =
  'id, spa_name, website, instagram, city, contact_name, channel, status, last_contacted_at, next_follow_up, notes, created_at, updated_at'
