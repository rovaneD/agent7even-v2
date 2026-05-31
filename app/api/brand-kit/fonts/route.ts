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

  const { role, family, weight, size_guide, source_url, notes } = await req.json()

  // One font per role per user — upsert on conflict (user_id, role)
  const { error } = await supabase
    .from('brand_kit_fonts')
    .upsert(
      { user_id: profileId, role, family, weight, size_guide, source_url, notes },
      { onConflict: 'user_id,role' }
    )

  if (error) {
    console.error('Font upsert error:', error)
    return NextResponse.json({ error: 'Failed to save font' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
