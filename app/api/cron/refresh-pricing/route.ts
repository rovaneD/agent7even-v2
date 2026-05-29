// app/api/cron/refresh-pricing/route.ts
// Refreshes OpenRouter model pricing every 6 hours
// Add to vercel.json: { "path": "/api/cron/refresh-pricing", "schedule": "0 */6 * * *" }

import { NextResponse } from 'next/server'
import { getModelPricing } from '@/lib/agents/cost'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Force fresh fetch by calling getModelPricing
    // It writes result back to platform_settings automatically
    const pricing = await getModelPricing()
    const modelCount = Object.keys(pricing).length

    return NextResponse.json({
      ok: true,
      models_cached: modelCount,
      refreshed_at: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    )
  }
}
