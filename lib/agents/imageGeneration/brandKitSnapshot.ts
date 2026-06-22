import { createServiceClient } from '@/lib/supabase/server'

export type BrandKitGenerationSnapshot = {
  available: boolean
  colors: Array<{ role: string; name: string | null; hex: string }>
  fonts: Array<{ role: string; family: string; weight: string | null; sizeGuide: string | null }>
  imageryStyle: string | null
  styleReferences: Array<{ name: string; description: string | null }>
  logos: Array<{ assetType: string; name: string }>
  brandName: string | null
}

const LOGO_TYPES = ['logo_primary', 'logo_alternate', 'logo_icon'] as const

/** Load Brand Kit fields used to ground image briefs (not sent to the image model as files in v1.1). */
export async function loadBrandKitGenerationSnapshot(
  profileId: string,
): Promise<BrandKitGenerationSnapshot> {
  const supabase = createServiceClient()

  const [
    { data: colors },
    { data: fonts },
    { data: assets },
    { data: imageryDoc },
  ] = await Promise.all([
    supabase
      .from('brand_kit_colors')
      .select('role, name, hex')
      .eq('user_id', profileId)
      .order('sort_order'),
    supabase.from('brand_kit_fonts').select('role, family, weight, size_guide').eq('user_id', profileId),
    supabase
      .from('brand_kit_assets')
      .select('asset_type, name, file_url, metadata')
      .eq('user_id', profileId)
      .in('section_key', ['identity', 'imagery']),
    supabase
      .from('foundation_documents')
      .select('markdown')
      .eq('user_id', profileId)
      .eq('type', 'imagery_style')
      .limit(1)
      .maybeSingle(),
  ])

  const logos = (assets ?? [])
    .filter(a => LOGO_TYPES.includes(a.asset_type as (typeof LOGO_TYPES)[number]))
    .map(a => ({ assetType: a.asset_type, name: a.name }))

  const styleReferences = (assets ?? [])
    .filter(a => a.asset_type === 'style_reference')
    .map(a => {
      const meta = (a.metadata ?? {}) as Record<string, unknown>
      const description =
        typeof meta.description === 'string' && meta.description.trim()
          ? meta.description.trim()
          : null
      return { name: a.name, description }
    })

  const snapshot: BrandKitGenerationSnapshot = {
    colors: (colors ?? []).map(c => ({
      role: c.role,
      name: c.name,
      hex: c.hex,
    })),
    fonts: (fonts ?? []).map(f => ({
      role: f.role,
      family: f.family,
      weight: f.weight,
      sizeGuide: f.size_guide,
    })),
    imageryStyle: imageryDoc?.markdown?.trim() || null,
    styleReferences,
    logos,
    brandName: null,
    available: false,
  }

  snapshot.available =
    snapshot.colors.length > 0
    || snapshot.fonts.length > 0
    || !!snapshot.imageryStyle
    || snapshot.styleReferences.length > 0
    || snapshot.logos.length > 0

  return snapshot
}

export function formatBrandKitBriefBlock(
  snapshot: BrandKitGenerationSnapshot,
  opts: { includeLogo: boolean; companyName: string },
): string {
  const lines: string[] = ['## Brand Kit (user opted in — follow exactly)']

  if (snapshot.colors.length > 0) {
    lines.push(
      'Colors (RENDER ONLY — paint with these values; NEVER print hex codes, color names, swatches, or legends on the image):',
      ...snapshot.colors.map(c => `- ${c.role}${c.name ? ` (${c.name})` : ''}: ${c.hex}`),
      '- Do NOT render color token labels like "Growth Green" or "#10B981" as visible text.',
    )
  }

  if (snapshot.fonts.length > 0) {
    lines.push(
      'Typography (for the image model to RENDER text — never print these as visible labels):',
      ...snapshot.fonts.map(
        f =>
          `- ${f.role}: use ${f.family}${f.weight ? ` at weight ${f.weight}` : ''}${f.sizeGuide ? ` (${f.sizeGuide} — sizing guide only, not copy)` : ''}`,
      ),
      '- CRITICAL: Do NOT render font family names, weights, or CSS specs (e.g. "Inter 600", "Lora Bold") as visible text on the image.',
    )
  }

  if (snapshot.imageryStyle) {
    lines.push('Imagery / mood:', snapshot.imageryStyle)
  }

  if (snapshot.styleReferences.length > 0) {
    lines.push(
      'Style references (match layout, density, and mood — not literal copy):',
      ...snapshot.styleReferences.map(
        ref => `- ${ref.name}${ref.description ? `: ${ref.description}` : ''}`,
      ),
    )
  }

  lines.push(
    'Layout rules:',
    '- Prefer minimal on-image text (one short headline max, under 8 words).',
    '- Avoid carousel multi-step copy, fake UI chrome, and generic stock-SaaS templates.',
    `- Brand name spelling when text appears: "${opts.companyName}" (exact casing and digits).`,
  )

  if (opts.includeLogo && snapshot.logos.length > 0) {
    lines.push(
      `- Include a logo mark area: reserve bottom-right (~15% width) with clean contrast. User has uploaded: ${snapshot.logos.map(l => l.name).join(', ')}.`,
      '- Do NOT invent a new wordmark — simple placement zone only; real logo may be composited later.',
    )
  } else {
    lines.push('- Do NOT include any logo, wordmark, monogram, or brand icon in the image.')
  }

  return lines.join('\n')
}
