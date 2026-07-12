import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateMorningDigest } from '@/lib/digest/morningDigest'
import {
  getWorkspaceSessionFromRequest,
  workspaceDataUserId,
} from '@/lib/profiles/workspaceSession'

export async function POST(req: Request) {
  const supabase = createServiceClient()
  const session = await getWorkspaceSessionFromRequest(supabase)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { profileId: requestedProfileId, forceRegenerate } = await req
    .json()
    .catch(() => ({} as { profileId?: unknown; forceRegenerate?: unknown }))

  const profileId = workspaceDataUserId(session)
  if (typeof requestedProfileId === 'string' && requestedProfileId !== profileId) {
    return NextResponse.json(
      { error: 'workspace_mismatch', message: 'Digest generation is limited to your workspace.' },
      { status: 403 },
    )
  }

  try {
    const result = await generateMorningDigest({
      supabase,
      profileId,
      forceRegenerate: forceRegenerate === true,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate digest'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
