import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

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

  // Fetch the asset first to verify ownership and get file_url for storage cleanup
  const { data: asset, error: fetchError } = await supabase
    .from('brand_kit_assets')
    .select('id, user_id, file_url')
    .eq('id', id)
    .single()

  if (fetchError || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  if (asset.user_id !== profileId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // If asset has a file stored in Supabase Storage, remove it
  if (asset.file_url) {
    const marker = 'brand-assets/'
    const markerIndex = (asset.file_url as string).indexOf(marker)
    if (markerIndex !== -1) {
      const storagePath = (asset.file_url as string).slice(markerIndex + marker.length)
      const { error: storageError } = await supabase.storage
        .from('brand-assets')
        .remove([storagePath])
      if (storageError) {
        console.error('Storage removal error (non-fatal):', storageError)
      }
    }
  }

  const { error: deleteError } = await supabase
    .from('brand_kit_assets')
    .delete()
    .eq('id', id)
    .eq('user_id', profileId)

  if (deleteError) {
    console.error('Asset delete error:', deleteError)
    return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
