import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

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

  const { sectionKey, completed } = await req.json()

  if (!sectionKey || completed === undefined) {
    return NextResponse.json({ error: 'Missing required fields: sectionKey, completed' }, { status: 400 })
  }

  const { error } = await supabase
    .from('brand_kit_sections')
    .upsert(
      {
        user_id: profileId,
        section_key: sectionKey,
        completed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,section_key' }
    )

  if (error) {
    console.error('Section complete upsert error:', error)
    return NextResponse.json({ error: 'Failed to update section' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
