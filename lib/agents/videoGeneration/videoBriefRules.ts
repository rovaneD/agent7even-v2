import { LAPTOP_SCREEN_SAFE_LINE } from '@/lib/agents/imageGeneration/fakeScreenUiDetection'
import { NO_ON_IMAGE_CTA_RULE } from '@/lib/agents/imageGeneration/onImageCtaDetection'

export const GLOBAL_VIDEO_BRIEF_RULES = `## Hard rules (video brief)
- NEVER include hex codes (#RRGGBB), bare hex values, or color token names in the brief text — describe colors as "electric blue accent", "deep slate", "clean white" — not "#B5451B" or "Insight Amber".
- NEVER copy font family names or weights (e.g. "Inter weight 700") — say "bold sans headline" or "bold display text".
- NEVER mention "Foundation", "Creative Direction", or "Brand Kit" as design system terms — write as if briefing a video director.
- NEVER invent fake customer testimonials, people, or unrelated industries.
- Stay in the business category described in Creative Direction — no random lifestyle or stock scenarios unrelated to the product.
- On-screen text overlay must be real marketing words only (max 8 words) — not brief instructions or model names.
- ${NO_ON_IMAGE_CTA_RULE}
- Describe motion as storytelling: "camera slowly zooms in", "text slides up from bottom", "scene cuts between product moments" — not technical specs.
- Scene color grade: neutral/cool daylight or clean office lighting — NOT sepia, brown wash, golden-hour amber, or coffee-shop warmth unless the post ask explicitly requests that mood.
- Prefer bright modern workspace, home-office desk, or product-adjacent scenes — NOT coffee shops or cozy café stock unless the post ask requests them.
- No logos on laptop lids, device backs, phone screens, neon wall signs, or background decor unless Must include requests a logo.
- ${LAPTOP_SCREEN_SAFE_LINE}
- If a scene includes product UI, describe screens as off, angled away, or soft out-of-focus — never readable fake dashboards or chart UI.`

export const VIDEO_BRIEF_KIND_SPEC = `${GLOBAL_VIDEO_BRIEF_RULES}
Write one 9:16 vertical short-form video brief (8 seconds) sent directly to a video generation model.
The brief is a single paragraph (120-220 words) that must describe:
1. SCENE DIRECTION — opening shot (0-2s), main action (2-6s), closing shot (6-8s); specific to this business
2. VISUAL TONE — lighting, palette in plain English, energy level; honor Creative Direction forbidden visuals
3. MOTION STYLE — camera movement and how text enters ("text fades in center-frame", "quick cuts between desk moments")
4. TEXT OVERLAY COPY — exactly 1-2 lines in double quotes (max 8 words total) tied to the post ask — specific marketing copy, NOT generic filler

Ground the brief in Creative Direction AND the post ask block — not generic stock SaaS or coffee-chat filler.
Honor weakSignals when present — lean on stronger fields instead of inventing generic copy.`
