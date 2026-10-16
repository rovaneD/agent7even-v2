import { createServiceClient } from '@/lib/supabase/server'

/** One row of public.post_styles — a proven creative recipe plus the model that renders it best. */
export type PostStyle = {
  id: string
  name: string
  tagline: string
  recipe: string
  model: string
  fallback_model: string | null
  uses_logo: boolean
  example_paths: string[]
  sort_order: number
}

export const AUTO_STYLE_ID = 'auto'

let cache: { at: number; styles: PostStyle[] } | null = null
const TTL_MS = 5 * 60 * 1000

/** Enabled styles in picker order. Cached for 5 minutes per server instance. */
export async function loadPostStyles(): Promise<PostStyle[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.styles
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('post_styles')
    .select('id,name,tagline,recipe,model,fallback_model,uses_logo,example_paths,sort_order')
    .eq('enabled', true)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(`post_styles: ${error.message}`)
  const styles = (data ?? []) as PostStyle[]
  cache = { at: Date.now(), styles }
  return styles
}

/**
 * Styles offered to the writer for this run.
 * A specific style id → just that style (every option in it). 'auto' or unknown → all enabled styles,
 * and the writer picks a different one per option.
 */
export async function resolveRunStyles(styleId: string | null | undefined): Promise<{
  mode: 'fixed' | 'auto'
  styles: PostStyle[]
}> {
  const all = await loadPostStyles()
  if (all.length === 0) throw new Error('post_styles_empty')
  const picked = styleId && styleId !== AUTO_STYLE_ID ? all.find(s => s.id === styleId) : undefined
  return picked ? { mode: 'fixed', styles: [picked] } : { mode: 'auto', styles: all }
}

/**
 * Signed URL for the workspace's primary brand-kit logo (raster preferred), for styles that attach
 * the real logo as an image reference. brand-assets is a private bucket, so the stored
 * "/object/public/..." URL is unusable by model providers — sign the storage path instead.
 */
export async function loadBrandLogoReference(profileId: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('brand_kit_assets')
    .select('asset_type,name,file_url,sort_order')
    .eq('user_id', profileId)
    .in('asset_type', ['logo_primary', 'logo_alternate'])
    .order('sort_order', { ascending: true })
  const rows = (data ?? []).filter(r => typeof r.file_url === 'string' && /^https:\/\//.test(r.file_url))
  const raster = (r: { name?: string | null; file_url: string }) => /\.(png|jpe?g|webp)$/i.test(r.name ?? r.file_url)
  const pick =
    rows.find(r => r.asset_type === 'logo_primary' && raster(r))
    ?? rows.find(r => raster(r))
  if (!pick) return null
  const m = String(pick.file_url).match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/)
  if (!m) return pick.file_url
  const { data: signed } = await supabase.storage.from(m[1]!).createSignedUrl(decodeURIComponent(m[2]!), 3600)
  return signed?.signedUrl ?? null
}

export const LOGO_REFERENCE_LINE =
  "The attached image is this company's real logo; reproduce it exactly as provided wherever the logo appears, same letterforms and colors."
