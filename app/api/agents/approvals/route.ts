import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { listPendingApprovalTasks } from '@/lib/agents/pendingApprovals'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  const profile = profileRows?.[0] ?? null
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const tasks = await listPendingApprovalTasks(supabase, profile.id)

  return NextResponse.json({ tasks })
}
