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

  const { id, role, name, hex, rgb, notes, sort_order } = await req.json()

  let savedRow: Record<string, unknown> | null = null

  if (id) {
    // UPDATE existing color — verify ownership via user_id
    const { data, error } = await supabase
      .from('brand_kit_colors')
      .update({ role, name, hex, rgb, notes })
      .eq('id', id)
      .eq('user_id', profileId)
      .select()
      .single()

    if (error) {
      console.error('Color update error:', error)
      return NextResponse.json({ error: 'Failed to update color' }, { status: 500 })
    }

    savedRow = data
  } else {
    // INSERT new color
    const { data, error } = await supabase
      .from('brand_kit_colors')
      .insert({ user_id: profileId, role, name, hex, rgb, notes, sort_order })
      .select()
      .single()

    if (error) {
      console.error('Color insert error:', error)
      return NextResponse.json({ error: 'Failed to create color' }, { status: 500 })
    }

    savedRow = data
  }

  return NextResponse.json({ success: true, color: savedRow })
}
