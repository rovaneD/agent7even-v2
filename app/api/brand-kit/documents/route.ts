import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const DOC_TITLE_MAP: Record<string, string> = {
  brief: 'Business Brief',
  icp: 'Ideal Customer Profile',
  positioning: 'Positioning Statement',
  voice: 'Brand Voice Guide',
  plan: '30-Day Marketing Plan',
  tagline: 'Tagline',
  elevator_pitch: 'Elevator Pitch',
  about_us: 'About Us',
  mission: 'Mission Statement',
}

export async function POST(req: Request) {
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

  const profileId = profile.id

  const { type, content } = await req.json()

  if (!type || content === undefined) {
    return NextResponse.json({ error: 'Missing required fields: type, content' }, { status: 400 })
  }

  // Check existing version to increment
  const { data: existing } = await supabase
    .from('foundation_documents')
    .select('version')
    .eq('user_id', profileId)
    .eq('type', type)
    .single()

  const newVersion = (existing?.version ?? 0) + 1

  const { error } = await supabase
    .from('foundation_documents')
    .upsert(
      {
        user_id: profileId,
        type,
        markdown: content,
        title: DOC_TITLE_MAP[type] ?? type,
        version: newVersion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,type' }
    )

  if (error) {
    console.error('Document upsert error:', error)
    return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
