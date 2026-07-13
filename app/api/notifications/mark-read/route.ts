import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, all } = await req.json()

  const supabase = createServiceClient()

  const profile = await resolveClerkProfile(supabase, userId, 'id')

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  if (all) {
    // Mark all as read
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('read', false)

    if (error) return NextResponse.json({ error: 'Failed to mark all as read' }, { status: 500 })
  } else if (id) {
    // Mark single notification as read — verify ownership
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', profile.id)

    if (error) return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
  } else {
    return NextResponse.json({ error: 'id or all required' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
