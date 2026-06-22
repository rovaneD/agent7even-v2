import type { SupabaseClient } from '@supabase/supabase-js'

/** Extract object path from a stored brand-assets file_url. */
export function storagePathFromBrandAssetFileUrl(fileUrl: string): string | null {
  const marker = '/brand-assets/'
  const idx = fileUrl.indexOf(marker)
  if (idx === -1) return null
  const raw = fileUrl.slice(idx + marker.length).split('?')[0]
  if (!raw) return null
  return decodeURIComponent(raw)
}

/** Signed URL for private brand-assets bucket (public file_url alone will 403). */
export async function createBrandAssetSignedUrl(
  supabase: SupabaseClient,
  storagePathOrFileUrl: string,
  expiresIn = 3600,
): Promise<string | null> {
  const path = storagePathOrFileUrl.includes('/brand-assets/')
    ? storagePathFromBrandAssetFileUrl(storagePathOrFileUrl)
    : storagePathOrFileUrl
  if (!path) return null

  const { data, error } = await supabase.storage.from('brand-assets').createSignedUrl(path, expiresIn)
  if (error) {
    console.error('[brandKit/signAssetUrl]', error.message)
    return null
  }
  return data?.signedUrl ?? null
}
