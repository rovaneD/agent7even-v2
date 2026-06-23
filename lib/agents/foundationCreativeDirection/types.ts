import { z } from 'zod'

export interface CreativeDirection {
  voiceProfile: {
    toneDo: string[]
    toneDont: string[]
    voiceSummary: string
  }
  customerPain: string
  headlineAngles: string[]
  product: {
    category: string
    keyNouns: string[]
    mustNotDepict: string[]
  }
  visualDirection: {
    aesthetic: string
    lighting: string
    casting: string
    paletteWords: string[]
    forbiddenVisuals: string[]
  }
  weakSignals?: string[]
}

export const CreativeDirectionSchema = z.object({
  voiceProfile: z.object({
    toneDo: z.array(z.string()).min(1),
    toneDont: z.array(z.string()),
    voiceSummary: z.string().min(1),
  }),
  customerPain: z.string().min(1),
  headlineAngles: z.array(z.string()).min(3).max(6),
  product: z.object({
    category: z.string().min(1),
    keyNouns: z.array(z.string()).min(1),
    mustNotDepict: z.array(z.string()),
  }),
  visualDirection: z.object({
    aesthetic: z.string().min(1),
    lighting: z.string().min(1),
    casting: z.string().min(1),
    paletteWords: z.array(z.string()),
    forbiddenVisuals: z.array(z.string()),
  }),
  weakSignals: z.array(z.string()).optional(),
})

export type CreativeDirectionParsed = z.infer<typeof CreativeDirectionSchema>

/** Compact block for brief composers (Step 3+) — not used in Step 2 wiring. */
export function formatCreativeDirectionBlock(dir: CreativeDirection, companyName: string): string {
  const lines = [
    `# Creative Direction — ${companyName}`,
    '',
    '## Voice',
    `Summary: ${dir.voiceProfile.voiceSummary}`,
    `Do: ${dir.voiceProfile.toneDo.join(', ')}`,
    `Don't: ${dir.voiceProfile.toneDont.join(', ') || '(none)'}`,
    '',
    '## Customer pain',
    dir.customerPain,
    '',
    '## Headline angles',
    ...dir.headlineAngles.map(a => `- ${a}`),
    '',
    '## Product',
    `Category: ${dir.product.category}`,
    `Key nouns: ${dir.product.keyNouns.join(', ')}`,
    `Must not depict: ${dir.product.mustNotDepict.join(', ') || '(none)'}`,
    '',
    '## Visual direction',
    `Aesthetic: ${dir.visualDirection.aesthetic}`,
    `Lighting: ${dir.visualDirection.lighting}`,
    `Casting: ${dir.visualDirection.casting}`,
    `Palette: ${dir.visualDirection.paletteWords.join(', ') || '(none)'}`,
    `Forbidden: ${dir.visualDirection.forbiddenVisuals.join(', ') || '(none)'}`,
    '',
    '## Visual render constraints (image + video)',
    '- Primary accent for on-screen typography: electric blue on white/slate — NOT brown, terracotta, amber, or orange unless palette above explicitly lists them.',
    '- Social post visuals: headline text overlay only (+ optional one short subhead) — NO on-image CTA buttons, pills, or link chrome.',
    '- "Warm" in aesthetic = human/candid photo tone, not brown UI chrome or sepia color grading.',
    '- Scene lighting: neutral/cool or clean office daylight — avoid sepia, brown wash, or coffee-shop golden-hour defaults.',
    '- No invented logo badges, circular wordmarks, floating brand icons, laptop-lid logos, neon wall signs, or graphic marks with the company name unless the post explicitly includes a logo.',
    '- Laptop/phone screens: off, angled away, or defocused — never readable fake dashboards or chart UI on screen.',
    '- Video: 9:16 vertical, 8 seconds — brief opening (0–2s), main action (2–6s), closing (2s); text overlay max 8 words tied to post goal.',
  ]
  if (dir.weakSignals?.length) {
    lines.push('', '## Weak signals', ...dir.weakSignals.map(s => `- ${s}`))
  }
  return lines.join('\n')
}
