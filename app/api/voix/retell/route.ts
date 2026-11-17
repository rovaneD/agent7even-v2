import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyRetellSignature, type RetellCall } from '@/lib/voix/retell'
import { ingestRetellEvent } from '@/lib/voix/ingest'

export const runtime = 'nodejs'

type LogRow = {
  event?: string | null
  retell_call_id?: string | null
  agent_id?: string | null
  account_id?: string | null
  result: 'stored' | 'ignored' | 'error' | 'bad_signature'
  detail?: string | null
}

/** Delivery log for the admin monitor. Never blocks or fails the webhook. */
async function logDelivery(supabase: SupabaseClient, row: LogRow) {
  const { error } = await supabase.from('voix_webhook_events').insert({ ...row, detail: row.detail?.slice(0, 500) ?? null })
  if (error) console.error('[voix/retell] delivery log failed:', error.message)
}

/**
 * Retell webhook (account-level or per-agent `webhook_url`).
 * Events: call_started, call_ended, call_analyzed.
 * Env: RETELL_API_KEY — the Retell API key with the webhook badge.
 */
export async function POST(req: Request) {
  const supabase = createServiceClient()
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) {
    console.error('[voix/retell] RETELL_API_KEY is not set')
    await logDelivery(supabase, { result: 'error', detail: 'RETELL_API_KEY is not set on the server' })
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const rawBody = await req.text()
  if (!verifyRetellSignature(rawBody, req.headers.get('x-retell-signature'), apiKey)) {
    await logDelivery(supabase, {
      result: 'bad_signature',
      detail: 'Signature check failed — is RETELL_API_KEY the key with the webhook badge?',
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: { event?: string; call?: RetellCall }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    await logDelivery(supabase, { result: 'error', detail: 'Body was not valid JSON' })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const call = payload.call ?? {}
  const base = { event: payload.event ?? null, retell_call_id: call.call_id ?? null, agent_id: call.agent_id ?? null }

  try {
    const result = await ingestRetellEvent(supabase, payload.event ?? '', call)
    if ('sales' in result) {
      await logDelivery(supabase, { ...base, result: 'stored', detail: result.sales })
    } else if ('ignored' in result) {
      await logDelivery(supabase, { ...base, account_id: result.accountId ?? null, result: 'ignored', detail: result.ignored })
    } else {
      await logDelivery(supabase, {
        ...base,
        account_id: result.accountId,
        result: 'stored',
        detail: result.followupCreated ? 'Follow-up created' : null,
      })
    }
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[voix/retell] ingest failed:', err)
    await logDelivery(supabase, { ...base, result: 'error', detail: err instanceof Error ? err.message : String(err) })
    // 500 lets Retell retry the delivery.
    return NextResponse.json({ error: 'Ingest failed' }, { status: 500 })
  }
}
