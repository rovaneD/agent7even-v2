import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { recordPilotRequest } from '@/lib/voix/pilotRequests'

const clean = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Public: Voix pilot applications from /voix. Emails the platform notify address. */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // Honeypot filled → pretend success, send nothing.
  if (clean(body.website)) return NextResponse.json({ ok: true })

  const name = clean(body.name)
  const spa = clean(body.spa)
  const email = clean(body.email, 320)
  const phone = clean(body.phone, 40)
  const software = clean(body.software, 60)
  const locations = clean(body.locations, 20)
  const instagram = clean(body.instagram, 120)

  if (!name || !spa || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please add your name, spa name and a valid email.' }, { status: 400 })
  }

  try {
    await recordPilotRequest(createServiceClient(), {
      source: 'form',
      contact_name: name,
      spa_name: spa,
      email,
      phone: phone || null,
      instagram: instagram || null,
      booking_software: software || null,
      locations: locations || null,
    })
  } catch (err) {
    console.error('Voix pilot email failed:', err)
    return NextResponse.json({ error: 'We couldn’t send that just now. Please email us instead.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
