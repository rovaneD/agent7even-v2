import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveClerkProfile } from '@/lib/profiles/resolveClerkProfile'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, prompt, category } = await req.json()
  if (!title || !prompt) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const supabase = createServiceClient()

  const profile = await resolveClerkProfile(supabase, userId, 'id')

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('saved_prompts')
    .insert({ user_id: profile.id, title, prompt, category: category ?? 'general' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ saved: data })
}
