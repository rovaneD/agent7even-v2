import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { createServiceClient } from '@/lib/supabase/server'

export type CreativeAssetFolderRow = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type CreativeAssetRow = {
  id: string
  user_id: string
  storage_path: string
  mime: string
  asset_type: string
  source: string
  brief_id: string | null
  option_index: number | null
  image_model: string | null
  image_model_label: string | null
  brief_excerpt: string | null
  brief: string | null
  qa_passed: boolean | null
  post_context: Record<string, unknown> | null
  folder_id: string | null
  is_favorite: boolean
  created_at: string
}

export type CreativeAssetWithUrl = CreativeAssetRow & { preview_url: string | null }

function normalizeFolderName(name: string): string {
  return name.trim().slice(0, 60)
}

export async function listCreativeAssetFolders(profileId: string): Promise<CreativeAssetFolderRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('creative_asset_folders')
    .select('*')
    .eq('user_id', profileId)
    .order('name', { ascending: true })

  if (error) {
    if (error.code === '42P01') return []
    console.error('[creativeAssets] list folders failed:', error.message)
    return []
  }

  return (data ?? []) as CreativeAssetFolderRow[]
}

export async function createCreativeAssetFolder(
  profileId: string,
  name: string,
): Promise<{ ok: true; folder: CreativeAssetFolderRow } | { ok: false; code: string; message: string }> {
  const normalized = normalizeFolderName(name)
  if (!normalized) {
    return { ok: false, code: 'invalid_name', message: 'Folder name is required.' }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('creative_asset_folders')
    .insert({ user_id: profileId, name: normalized })
    .select()
    .single()

  if (error) {
    if (error.code === '42P01') {
      return {
        ok: false,
        code: 'table_missing',
        message: 'Folders not ready — run 21_creative_asset_folders.sql in Supabase.',
      }
    }
    if (error.code === '23505') {
      return { ok: false, code: 'duplicate_name', message: 'A folder with that name already exists.' }
    }
    console.error('[creativeAssets] create folder failed:', error.message)
    return { ok: false, code: 'create_failed', message: 'Could not create folder.' }
  }

  return { ok: true, folder: data as CreativeAssetFolderRow }
}

export async function deleteCreativeAssetFolder(profileId: string, folderId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('creative_asset_folders')
    .delete()
    .eq('id', folderId)
    .eq('user_id', profileId)

  return !error
}

export async function deleteCreativeAsset(profileId: string, assetId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('creative_assets')
    .delete()
    .eq('id', assetId)
    .eq('user_id', profileId)

  return !error
}

export async function moveCreativeAssetToFolder(
  profileId: string,
  assetId: string,
  folderId: string | null,
): Promise<boolean> {
  const supabase = createServiceClient()

  if (folderId) {
    const { data: folder } = await supabase
      .from('creative_asset_folders')
      .select('id')
      .eq('id', folderId)
      .eq('user_id', profileId)
      .maybeSingle()

    if (!folder) return false
  }

  const { error } = await supabase
    .from('creative_assets')
    .update({ folder_id: folderId })
    .eq('id', assetId)
    .eq('user_id', profileId)

  return !error
}

export async function updateCreativeAsset(
  profileId: string,
  assetId: string,
  updates: { isFavorite?: boolean; folderId?: string | null },
): Promise<boolean> {
  if (updates.folderId !== undefined) {
    const moved = await moveCreativeAssetToFolder(profileId, assetId, updates.folderId)
    if (!moved) return false
  }

  if (updates.isFavorite !== undefined) {
    const ok = await setCreativeAssetFavorite(profileId, assetId, updates.isFavorite)
    if (!ok) return false
  }

  return true
}

export async function listCreativeAssets(profileId: string): Promise<CreativeAssetWithUrl[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('creative_assets')
    .select('*')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[creativeAssets] list failed:', error.message)
    return []
  }

  return Promise.all(
    (data ?? []).map(async row => ({
      ...(row as CreativeAssetRow),
      preview_url: await createPostAssetSignedUrl(row.storage_path, 3600),
    })),
  )
}

export async function getCreativeAssetById(
  profileId: string,
  assetId: string,
): Promise<CreativeAssetWithUrl | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('creative_assets')
    .select('*')
    .eq('id', assetId)
    .eq('user_id', profileId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as CreativeAssetRow
  return {
    ...row,
    preview_url: await createPostAssetSignedUrl(row.storage_path, 3600),
  }
}

export async function saveCreativeAsset(opts: {
  profileId: string
  storagePath: string
  mime: string
  briefId?: string | null
  optionIndex?: number | null
  imageModel?: string | null
  imageModelLabel?: string | null
  briefExcerpt?: string | null
  brief?: string | null
  qaPassed?: boolean | null
  postContext?: Record<string, unknown> | null
}): Promise<{ ok: true; asset: CreativeAssetRow } | { ok: false; code: string; message: string }> {
  if (!opts.storagePath.startsWith(`${opts.profileId}/`)) {
    return { ok: false, code: 'invalid_path', message: 'Invalid asset path.' }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('creative_assets')
    .upsert(
      {
        user_id: opts.profileId,
        storage_path: opts.storagePath,
        mime: opts.mime,
        asset_type: 'image',
        source: 'generation',
        brief_id: opts.briefId ?? null,
        option_index: opts.optionIndex ?? null,
        image_model: opts.imageModel ?? null,
        image_model_label: opts.imageModelLabel ?? null,
        brief_excerpt: opts.briefExcerpt?.slice(0, 500) ?? opts.brief?.slice(0, 500) ?? null,
        brief: opts.brief ?? null,
        qa_passed: opts.qaPassed ?? null,
        post_context: opts.postContext ?? null,
      },
      { onConflict: 'user_id,storage_path', ignoreDuplicates: false },
    )
    .select()
    .single()

  if (error) {
    if (error.code === '42P01') {
      return {
        ok: false,
        code: 'table_missing',
        message: 'Asset library not ready — run 19_creative_assets.sql in Supabase.',
      }
    }
    console.error('[creativeAssets] save failed:', error.message)
    return { ok: false, code: 'save_failed', message: 'Could not save to library.' }
  }

  return { ok: true, asset: data as CreativeAssetRow }
}

export async function setCreativeAssetFavorite(
  profileId: string,
  assetId: string,
  isFavorite: boolean,
): Promise<boolean> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('creative_assets')
    .update({ is_favorite: isFavorite })
    .eq('id', assetId)
    .eq('user_id', profileId)

  return !error
}
