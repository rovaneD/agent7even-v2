import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveFoundationWorkspaceForClerkUser } from '@/lib/foundation/resolveFoundationWorkspace'
import { enrichFromWebsite } from '@/lib/foundation/enrichFromWebsite'
import { parseSiteSnapshot, type SiteSnapshot } from '@/lib/foundation/siteSnapshot'
import { resolveSiteSnapshotScrapeUrl } from '@/lib/foundation/resolveSiteSnapshotScrapeUrl'

const WORKSPACE_SITE_SELECT =
  'id, company_name, website_url, site_snapshot, site_snapshot_enabled, site_snapshot_generated_at, site_snapshot_source_url'

type WorkspaceSiteProfile = {
  id: string
  company_name: string | null
  website_url: string | null
  site_snapshot: unknown
  site_snapshot_enabled: boolean | null
  site_snapshot_generated_at: string | null
  site_snapshot_source_url: string | null
}

async function loadWorkspaceSiteProfile(clerkUserId: string): Promise<{
  memberId: string
  workspace: WorkspaceSiteProfile
} | null> {
  const supabase = createServiceClient()
  const session = await resolveFoundationWorkspaceForClerkUser(supabase, clerkUserId)
  if (!session) return null

  const { data } = await supabase
    .from('profiles')
    .select(WORKSPACE_SITE_SELECT)
    .eq('id', session.workspaceId)
    .maybeSingle()

  if (!data) return null
  return { memberId: session.memberId, workspace: data as WorkspaceSiteProfile }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const loaded = await loadWorkspaceSiteProfile(userId)
    if (!loaded) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    const { workspace } = loaded

    return NextResponse.json({
      websiteUrl: workspace.website_url,
      snapshot: parseSiteSnapshot(workspace.site_snapshot),
      enabled: workspace.site_snapshot_enabled ?? false,
      generatedAt: workspace.site_snapshot_generated_at,
      sourceUrl: workspace.site_snapshot_source_url,
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const loaded = await loadWorkspaceSiteProfile(userId)
    if (!loaded) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    const { memberId, workspace } = loaded

    const body = await req.json().catch(() => ({}))
    const requestedWebsiteUrl =
      typeof body.websiteUrl === 'string' ? body.websiteUrl : null
    const websiteUrl = resolveSiteSnapshotScrapeUrl({
      memberId,
      workspaceId: workspace.id,
      workspaceWebsiteUrl: workspace.website_url,
      requestedWebsiteUrl,
    })

    if (!websiteUrl) {
      return NextResponse.json(
        { error: 'Save a website URL in Foundation → Your Business first.' },
        { status: 400 },
      )
    }

    const snapshot = await enrichFromWebsite({
      websiteUrl,
      companyName: workspace.company_name,
    })

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        site_snapshot: snapshot,
        site_snapshot_source_url: snapshot.sourceUrl,
        site_snapshot_generated_at: new Date().toISOString(),
        site_snapshot_enabled: true,
      })
      .eq('id', workspace.id)

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

    const loaded = await loadWorkspaceSiteProfile(userId)
    if (!loaded) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    const { workspace } = loaded

    const body = await req.json().catch(() => ({}))
    const supabase = createServiceClient()

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

    const { error } = await supabase.from('profiles').update(patch).eq('id', workspace.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
