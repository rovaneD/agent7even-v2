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

  let teamEmailError: unknown = null
  try {
    await sendTransactionalEmail({
      to: await getNotifyEmail(),
      replyTo: input.email || undefined,
      subject: `Voix pilot request — ${input.spa_name || input.contact_name || 'new spa'}${input.source === 'phone' ? ' (by phone)' : ''}`,
      title: 'New Voix pilot request',
      body: lines.join('\n'),
      link: '/voix/app/admin?view=spas',
      ctaLabel: 'Open pilot requests →',
      throwOnError: true,
    })
  } catch (err) {
    teamEmailError = err
    console.error('[voix/pilot] team email failed:', err)
  }

  // Confirmation to the applicant (website form only; phone callers hear it on the call).
  if (input.source === 'form' && input.email) {
    await sendTransactionalEmail({
      to: input.email,
      replyTo: await getNotifyEmail(),
      subject: 'We got your Voix pilot application',
      title: `Thanks${input.contact_name ? `, ${input.contact_name.split(' ')[0]}` : ''}. Your application is in.`,
      body: [
        `We received your application for ${input.spa_name || 'your spa'} to join the Voix pilot. Here\u2019s what happens next:`,
        '1. We review your application and reply within one business day.\n2. A 30-minute setup call: we learn your treatments, pricing, policies and how you like to sound. We do the setup.\n3. You approve every answer. Nothing goes live until you do.\n4. Voix starts answering: you forward missed and after-hours calls, your number stays the same, and you get a summary of every call.',
        'The pilot is 14 days free, no credit card. We ask for the setup call, access to your booking software and a short weekly check-in.',
        'When the 14 days end, you get a results report. To continue, founding spas pay $149 a month per location with unlimited calls, locked for 12 months. No setup fee, no contract. If you don\u2019t continue, you simply stop forwarding calls to Voix.',
        'If the 10 founding spots fill, we\u2019ll offer you a place in the next group. Questions in the meantime? Just reply to this email.',
      ].join('\n\n'),
    }).catch((err) => console.error('[voix/pilot] confirmation email failed:', err))
  }

  // Only fail the request if nothing reached us at all.
  if (error && teamEmailError) throw teamEmailError
}
