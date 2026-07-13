import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { answers, completed } = await req.json()

  const supabase = createServiceClient()

  const profile = await resolveClerkProfile(supabase, userId, 'id')

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { error } = await supabase
    .from('brand_answers')
    .upsert({
      user_id: profile.id,
      answers,
      completed: completed ?? false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('Save answers error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
