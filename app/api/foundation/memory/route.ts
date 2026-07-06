import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadFoundationMemory } from '@/lib/agents/loadFoundationContext'
import { loadFoundationChangelog } from '@/lib/foundation/changelogContext'
import { formatChangelogObservationsForHub } from '@/lib/foundation/changelogHubObservations'
import { resolveFoundationWorkspaceForClerkUser } from '@/lib/foundation/resolveFoundationWorkspace'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServiceClient()
    const session = await resolveFoundationWorkspaceForClerkUser(supabase, userId)
    if (!session) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const [memory, changelog] = await Promise.all([
      loadFoundationMemory(session.workspaceId),
      loadFoundationChangelog(session.memberId, 20),
    ])

    return NextResponse.json({
      ...memory,
      observations: formatChangelogObservationsForHub(changelog),
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
