import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/maya/session — returns most recent session for the authenticated user
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ session: null })

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('messages, mode')
    .eq('user_id', profile.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ session: session ?? null })
}

// POST /api/maya/session — upserts one session per user (overwrites on conflict)
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId: profileId, messages, mode } = await req.json()
  if (!profileId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('chat_sessions')
    .upsert(
      {
        user_id: profileId,
        messages: messages ?? [],
        mode: mode ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error) {
    console.error('[session] upsert error:', error.message)
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
