import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyRetellSignature, type RetellCall } from '@/lib/voix/retell'
import { ingestRetellEvent } from '@/lib/voix/ingest'

export const runtime = 'nodejs'

/**
 * Retell webhook (account-level or per-agent `webhook_url`).
 * Events: call_started, call_ended, call_analyzed.
 * Env: RETELL_API_KEY — the Retell API key with the webhook badge.
 */
export async function POST(req: Request) {
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) {
    console.error('[voix/retell] RETELL_API_KEY is not set')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const rawBody = await req.text()
  if (!verifyRetellSignature(rawBody, req.headers.get('x-retell-signature'), apiKey)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: { event?: string; call?: RetellCall }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const result = await ingestRetellEvent(createServiceClient(), payload.event ?? '', payload.call ?? {})
    if ('ignored' in result) console.info('[voix/retell] ignored:', result.ignored)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[voix/retell] ingest failed:', err)
    // 500 lets Retell retry the delivery.
    return NextResponse.json({ error: 'Ingest failed' }, { status: 500 })
  }
}
