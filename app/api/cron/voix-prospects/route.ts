import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { topUpProspects } from '@/lib/voix/prospectFinder'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Daily safety net for Voix outreach. The top-up normally starts the moment the
 * last spa leaves "To contact"; this catches a missed or failed run.
 */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await topUpProspects(createServiceClient(), 'cron')
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
