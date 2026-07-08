import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveFoundationWorkspaceForClerkUser } from '@/lib/foundation/resolveFoundationWorkspace'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServiceClient()
    const session = await resolveFoundationWorkspaceForClerkUser(supabase, userId)
    if (!session) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('foundation_knowledge')
      .select('id, source_type, source_name, source_purpose, purpose_confidence, purpose_reason, extraction_result, confirmed_fields, created_at')
      .eq('profile_id', session.workspaceId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
