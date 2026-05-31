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
  const contentType = req.headers.get('content-type') ?? ''

  // Mode A: multipart/form-data — file upload
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string | null
    const sectionKey = formData.get('sectionKey') as string | null
    const assetType = formData.get('assetType') as string | null

    if (!file || !name || !sectionKey || !assetType) {
      return NextResponse.json({ error: 'Missing required fields: file, name, sectionKey, assetType' }, { status: 400 })
    }

    const storagePath = `${profileId}/${sectionKey}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('brand-assets')
      .upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Asset upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage
      .from('brand-assets')
      .getPublicUrl(storagePath)

    const fileUrl = publicUrlData.publicUrl

    const { data: assetRow, error: insertError } = await supabase
      .from('brand_kit_assets')
      .insert({
        user_id: profileId,
        name,
        section_key: sectionKey,
        asset_type: assetType,
        file_url: fileUrl,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Asset insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save asset record' }, { status: 500 })
    }

    return NextResponse.json({ success: true, asset: assetRow })
  }

  // Mode B: application/json — external link
  const { name, section_key, asset_type, external_url, metadata } = await req.json()

  if (!name || !section_key || !asset_type || !external_url) {
    return NextResponse.json({ error: 'Missing required fields: name, section_key, asset_type, external_url' }, { status: 400 })
  }

  const { data: assetRow, error: insertError } = await supabase
    .from('brand_kit_assets')
    .insert({
      user_id: profileId,
      name,
      section_key,
      asset_type,
      external_url,
      ...(metadata !== undefined ? { metadata } : {}),
    })
    .select()
    .single()

  if (insertError) {
    console.error('Asset external link insert error:', insertError)
    return NextResponse.json({ error: 'Failed to save asset' }, { status: 500 })
  }

  return NextResponse.json({ success: true, asset: assetRow })
}
