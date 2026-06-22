import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import {
  deleteCreativeAsset,
  getCreativeAssetById,
  updateCreativeAsset,
} from '@/lib/creativeAssets'
import { createServiceClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
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

  const asset = await getCreativeAssetById(profile.id, id)
  if (!asset) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ asset })
}

export async function PATCH(req: Request, { params }: Params) {
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

  let body: { isFavorite?: boolean; folderId?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (body.isFavorite === undefined && body.folderId === undefined) {
    return NextResponse.json({ error: 'no_updates' }, { status: 400 })
  }

  const ok = await updateCreativeAsset(profile.id, id, {
    isFavorite: body.isFavorite,
    folderId: body.folderId,
  })
  if (!ok) return NextResponse.json({ error: 'update_failed' }, { status: 500 })

  return NextResponse.json({ success: true })
}

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

  const ok = await deleteCreativeAsset(profile.id, id)
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 })

  return NextResponse.json({ success: true })
}
