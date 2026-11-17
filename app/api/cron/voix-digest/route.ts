import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { localDateKey, localHour, sendDigest } from '@/lib/voix/digest'
import type { VoixAccount } from '@/lib/voix/types'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Hourly. Sends each spa its daily digest once per local day, at or after the
 * spa's digest_hour (default 8am). A failed send is retried the next hour.
 */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: accounts, error } = await supabase
    .from('voix_accounts')
    .select('id, name, timezone, alert_emails, status, digest_enabled, digest_hour')
    .eq('digest_enabled', true)
    .neq('status', 'paused')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = new Date()
  const results: { account: string; outcome: string }[] = []

  for (const account of (accounts ?? []) as Pick<
    VoixAccount,
    'id' | 'name' | 'timezone' | 'alert_emails' | 'status' | 'digest_enabled' | 'digest_hour'
  >[]) {
    if (localHour(account.timezone, now) < account.digest_hour) continue
    const today = localDateKey(account.timezone, now)

    const { data: existing } = await supabase
      .from('voix_digest_log')
      .select('id, error')
      .eq('account_id', account.id)
      .eq('digest_date', today)
      .eq('is_test', false)
      .maybeSingle()
    if (existing && !existing.error) continue
    if (existing?.error) await supabase.from('voix_digest_log').delete().eq('id', existing.id)

    try {
      const res = await sendDigest(supabase, account, { test: false, now })
      results.push({ account: account.name, outcome: res.sent ? `sent to ${res.recipients}` : `skipped: ${res.reason}` })
    } catch (err) {
      console.error('[cron/voix-digest] failed for', account.id, err)
      results.push({ account: account.name, outcome: `error: ${err instanceof Error ? err.message : String(err)}` })
    }
  }

  return NextResponse.json({ ok: true, results })
}
