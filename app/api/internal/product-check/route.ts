import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getWorkspaceAuthContext, workspaceDataUserId } from '@/lib/profiles/workspaceSession'
import { checkProductStill, type ProductStillKey } from '@/lib/agents/videoGeneration/productAdJob'

/**
 * Internal (test accounts only): run the Product ad product check on any stills, to measure it against
 * known-bad stills. Body { photos: [path], stills: [{ key, path }], productName, details? }.
 */
export const maxDuration = 120
const INTERNAL_EMAILS = new Set(['rovane@dursodesign.com', 'melissa@agent7even.com', 'rovdurs@gmail.com'])

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx?.email || !INTERNAL_EMAILS.has(ctx.email.toLowerCase())) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const profileId = workspaceDataUserId(ctx.session)
  const body = (await req.json().catch(() => ({}))) as { photos?: string[]; stills?: Array<{ key: ProductStillKey; path: string }>; productName?: string; details?: string }
  const own = (p: unknown) => typeof p === 'string' && p.startsWith(`${profileId}/`)
  const photos = (body.photos ?? []).filter(own).slice(0, 4)
  const stills = (body.stills ?? []).filter(s => own(s.path)).slice(0, 8)
  const results = await Promise.all(stills.map(s =>
    checkProductStill({ photos, stills: { [s.key]: s.path }, productName: String(body.productName ?? ''), details: String(body.details ?? '') }, s.key),
  ))
  return NextResponse.json({ results: stills.map((s, i) => ({ path: s.path.split('/').pop(), ...results[i] })) })
}
