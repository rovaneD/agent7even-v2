import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
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
  const profile = profileRows?.[0]
  if (!profile) return NextResponse.json([])

  const { data: sessions } = await supabase
    .from('maya_sessions')
    .select('id, title, canvas_context, updated_at')
    .eq('user_id', profile.id)
    .order('updated_at', { ascending: false })
    .limit(20)

  return NextResponse.json(sessions ?? [])
}
