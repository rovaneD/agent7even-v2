import { NextResponse } from 'next/server'
import { sendTransactionalEmail } from '@/lib/email/sendTransactionalEmail'
import { getNotifyEmail } from '@/lib/getNotifyEmail'

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

  if (!name || !spa || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please add your name, spa name and a valid email.' }, { status: 400 })
  }

  try {
    const to = await getNotifyEmail()
    await sendTransactionalEmail({
      to,
      replyTo: email,
      subject: `Voix pilot application — ${spa}`,
      title: 'New Voix pilot application',
      body: [
        `Name: ${name}`,
        `Spa: ${spa}`,
        `Email: ${email}`,
        `Phone: ${phone || '—'}`,
        `Booking software: ${software || '—'}`,
        `Locations: ${locations || '—'}`,
      ].join('\n'),
    })
  } catch (err) {
    console.error('Voix pilot email failed:', err)
    return NextResponse.json({ error: 'We couldn’t send that just now. Please email us instead.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
