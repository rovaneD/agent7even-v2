import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'
import { enrichFromWebsite } from '@/lib/foundation/enrichFromWebsite'
import { parseSiteSnapshot, type SiteSnapshot } from '@/lib/foundation/siteSnapshot'
import { normalizeWebsiteUrl } from '@/lib/maya/canonicalWebsite'

async function resolveProfile(clerkUserId: string) {
  const supabase = createServiceClient()
  return resolveClerkProfile<{
    id: string
    company_name: string | null
    website_url: string | null
    site_snapshot: unknown
    site_snapshot_enabled: boolean | null
    site_snapshot_generated_at: string | null
    site_snapshot_source_url: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    plan: string | null
    created_at: string
  }>(
    supabase,
    clerkUserId,
    'id, company_name, website_url, site_snapshot, site_snapshot_enabled, site_snapshot_generated_at, site_snapshot_source_url',
  )
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await resolveProfile(userId)
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    return NextResponse.json({
      websiteUrl: profile.website_url,
      snapshot: parseSiteSnapshot(profile.site_snapshot),
      enabled: profile.site_snapshot_enabled ?? false,
      generatedAt: profile.site_snapshot_generated_at,
      sourceUrl: profile.site_snapshot_source_url,
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await resolveProfile(userId)
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const urlOverride =
      typeof body.websiteUrl === 'string' ? normalizeWebsiteUrl(body.websiteUrl) : null
    const websiteUrl = urlOverride ?? normalizeWebsiteUrl(profile.website_url)

    if (!websiteUrl) {
      return NextResponse.json(
        { error: 'Save a website URL in Foundation → Your Business first.' },
        { status: 400 },
      )
    }

    const snapshot = await enrichFromWebsite({
      websiteUrl,
      companyName: profile.company_name,
    })

    const supabase = createServiceClient()
    const workspaceId = await resolveWorkspaceProfileId(supabase, profile.id)

    const { error } = await supabase
      .from('profiles')
      .update({
        site_snapshot: snapshot,
        site_snapshot_source_url: snapshot.sourceUrl,
        site_snapshot_generated_at: new Date().toISOString(),
        site_snapshot_enabled: true,
      })
      .eq('id', workspaceId)

    if (error) {
      if (error.message.includes('site_snapshot')) {
        return NextResponse.json(
          { error: 'Run 34_foundation_site_snapshot.sql in Supabase first.' },
          { status: 500 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ snapshot, enabled: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await resolveProfile(userId)
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const supabase = createServiceClient()
    const workspaceId = await resolveWorkspaceProfileId(supabase, profile.id)

    const patch: Record<string, unknown> = {}

    if (typeof body.enabled === 'boolean') {
      patch.site_snapshot_enabled = body.enabled
    }

    if (body.snapshot != null) {
      const snapshot = parseSiteSnapshot(body.snapshot)
      if (!snapshot) {
        return NextResponse.json({ error: 'Invalid snapshot shape' }, { status: 400 })
      }
      patch.site_snapshot = snapshot as SiteSnapshot
      patch.site_snapshot_source_url = snapshot.sourceUrl
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { error } = await supabase.from('profiles').update(patch).eq('id', workspaceId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
