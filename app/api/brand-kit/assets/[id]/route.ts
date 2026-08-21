import { NextResponse } from 'next/server'
import { brandKitGateResponse, requireBrandKitWorkspace } from '@/lib/brandKit/brandKitWorkspace'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createServiceClient()
  const gate = await requireBrandKitWorkspace(supabase)
  if (!gate.ok) return brandKitGateResponse(gate)
  const profileId = gate.workspaceId

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
