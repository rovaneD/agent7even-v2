import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardProfileForClerkUser } from '@/lib/profiles/getDashboardProfile'
import { resolveWorkspaceProfileId } from '@/lib/profiles/workspaceProfile'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null
  const profile = await getDashboardProfileForClerkUser(supabase, userId, email)

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  const workspaceId = await resolveWorkspaceProfileId(supabase, profile.id)

  const url = new URL(req.url)
  const statuses = url.searchParams.getAll('status')

  let query = supabase
    .from('agent_tasks')
    .select('*')
    .eq('user_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (statuses.length > 0) {
    query = query.in('status', statuses)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
