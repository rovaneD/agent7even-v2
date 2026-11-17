import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'
import { getNotifyEmail } from '@/lib/getNotifyEmail'

export type PilotRequestInput = {
  source: 'form' | 'phone'
  contact_name?: string | null
  spa_name?: string | null
  email?: string | null
  phone?: string | null
  instagram?: string | null
  booking_software?: string | null
  locations?: string | null
  preferred_time?: string | null
  notes?: string | null
  retell_call_id?: string | null
}

/** "@lumenspa" from "lumenspa", "@lumenspa" or "https://instagram.com/lumenspa/". */
export function normalizeInstagram(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  const fromUrl = raw.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1]
  const handle = (fromUrl ?? raw).replace(/^@+/, '').replace(/[/?#].*$/, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `@${handle.toLowerCase()}` : raw.slice(0, 80)
}

/** Save a pilot request and email the team. Email still goes out if the insert fails. */
export async function recordPilotRequest(supabase: SupabaseClient, input: PilotRequestInput) {
  const row = { ...input, instagram: normalizeInstagram(input.instagram) }
  const { error } = await supabase
    .from('voix_pilot_requests')
    .upsert(row, row.retell_call_id ? { onConflict: 'retell_call_id', ignoreDuplicates: true } : undefined)
  if (error) console.error('[voix/pilot] save failed:', error.message)

  const lines = [
    `Source: ${input.source === 'phone' ? 'Call to the Voix line' : 'Website form'}`,
    `Name: ${input.contact_name || '—'}`,
    `Spa: ${input.spa_name || '—'}`,
    `Email: ${input.email || '—'}`,
    `Phone: ${input.phone || '—'}`,
    `Instagram: ${row.instagram || '—'}`,
    `Booking software: ${input.booking_software || '—'}`,
    `Locations: ${input.locations || '—'}`,
    input.preferred_time ? `Best time for the setup call: ${input.preferred_time}` : null,
    input.notes ? `Notes: ${input.notes}` : null,
  ].filter(Boolean)

  await sendTransactionalEmail({
    to: await getNotifyEmail(),
    replyTo: input.email || undefined,
    subject: `Voix pilot request — ${input.spa_name || input.contact_name || 'new spa'}${input.source === 'phone' ? ' (by phone)' : ''}`,
    title: 'New Voix pilot request',
    body: lines.join('\n'),
    link: '/voix/app/admin?view=spas',
    ctaLabel: 'Open pilot requests →',
  })
}
