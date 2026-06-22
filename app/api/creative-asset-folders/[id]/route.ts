import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { deleteCreativeAssetFolder } from '@/lib/creativeAssets'
import { createServiceClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const ok = await deleteCreativeAssetFolder(profile.id, id)
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 })

  return NextResponse.json({ success: true })
}
