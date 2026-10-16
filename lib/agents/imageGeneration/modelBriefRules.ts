import type { ImageGenerationModelId } from './imageModelCatalog'

/** Per-model constraints appended to image brief compose. */
export function modelBriefRulesBlock(modelId: ImageGenerationModelId): string {
  switch (modelId) {
    case 'photoreal':
      return [
        '## Image model constraints (Photoreal)',
        '- NO readable text, labels, flowchart nodes, UI chrome, or captions baked into the image.',
        '- NO bar charts, infographics, pillar diagrams, stat dashboards, or data visualizations.',
        '- Abstract, photographic, or metaphorical visual only — message lives in the post caption.',
      ].join('\n')
    case 'sharp-text':
      return [
        '## Image model constraints (Sharp text)',
        '- At most ONE headline (under 8 words) plus optionally ONE short subhead — no CTA buttons.',
        '- Social POST layout — NOT a logo tile, wordmark lockup, monogram, or abstract brand-mark hero.',
        '- No color swatches, hex codes, legends, multi-step carousels, or fake dashboards with lorem labels.',
      ].join('\n')
    case 'latest-gemini':
      return [
        '## Image model constraints (Latest Gemini)',
        '- Minimal on-image text; no design-spec legends or color token callouts.',
      ].join('\n')
    case 'balanced':
    default:
      return [
        '## Image model constraints (Balanced)',
        '- Minimal on-image text; prefer one strong headline over dense copy.',
        '- Headline-only overlay — NO CTA buttons, pills, or "See how it works" / "Learn how" link chrome.',
        '- NO circular logo badges, floating brand icons, invented wordmarks, laptop-lid logos, neon wall signs, or environmental brand marks.',
        '- Laptop screens off, angled away, or defocused — never a readable fake dashboard or chart UI on screen.',
        '- Neutral/cool scene grade — no sepia, brown, or golden-hour wash; blue accent in headline typography only.',
      ].join('\n')
  }
}

export const IMAGE_ART_DIRECTION_RULES = `## Art direction (every image option)
Generic AI stock is the failure mode: conference rooms, meeting tables, teams around laptops, people smiling at screens, handshakes, glass-walled or open-plan offices, whiteboard sessions, "modern workspace" scenes. NEVER brief these unless the post ask names that exact scene.
Each option uses ONE of these formats and opens its brief with one plain sentence (no label, no format name) saying how the image literally connects to its headline. Never write the format names below into the brief text:
- TYPE-LED: the headline is the hero, set large on a flat or subtly textured brand-color field, with one simple graphic device (an oversized number, an underline or strike-through, a bold color block). No photograph.
- OBJECT METAPHOR: one specific physical object that embodies the pain or payoff in the headline (e.g. a towering stack of unread reports, a snapped pencil, a stopwatch at 4:59), shot like a product photo — studio lighting, plain seamless background, generous negative space for the headline. No people.
- DETAIL CROP: a tight, specific close-up of one real moment tied to the headline (a hand crossing out a line on a printed plan, a single phone notification) — never a wide shot of a room or a group.
If you cannot connect a scene to the headline in one sentence, use TYPE-LED.`

export const GLOBAL_IMAGE_BRIEF_RULES = `## Hard rules (every image option)
- NEVER include hex codes (#RRGGBB), bare hex values, or parentheses like "(#10B981)" in the brief text — image models copy them onto the image as labels.
- NEVER copy Brand Kit color token names (e.g. "Growth Green", "Strategic Slate", "Insight Amber") into the brief — say "brand green accent" or "deep slate" instead.
- NEVER copy font family names or weights (e.g. "Inter weight 700") into the brief — say "bold sans headline" if on-image text is allowed for this model.
- NEVER print hex codes, color token names, swatches, font specs, or design-system legends as visible text in the final image — apply colors/fonts in the render only.
- NEVER invent fake customer testimonials or named people, and never drift into an industry other than this company's own unless the post ask explicitly requests it.
- Stay in the business category described in Foundation for THIS company — its own product, customers, and setting.
- Headline typography accent: electric blue on white/slate unless Creative Direction palette explicitly names earthy tones — never default to brown, terracotta, or amber.
- NO on-image CTA buttons, pills, or link chrome ("See how it works", "Learn how", "Start free trial") — headline (+ optional subhead) only. Offer/CTA field informs headline angle; actual CTA lives in the post caption.
- Scene color grade: neutral/cool daylight or clean studio lighting — NOT sepia, brown wash, golden-hour amber, or coffee-shop warmth unless the post ask explicitly requests that mood.
- No logos on laptop lids, device backs, phone screens, neon wall signs, or background decor when logo is off.
- Laptop/phone screens: turned away from camera, closed, dark, or soft out-of-focus — NEVER a readable fake dashboard, chart grid, or SaaS UI on the screen. No desk papers with fake charts unless the post ask requests data viz.
- No fake UI mockups with gibberish labels or lorem filler in prominent areas.
- On-image copy must be real marketing words only — not brief instructions, model names, or metadata.
- Social POST images only — NEVER brief a logo lockup, wordmark tile, monogram hero, or abstract brand-mark symbol. The company name must not be the main visual; use a post-specific headline about the offer or pain point instead.
- Every option MUST tie to the post form (Post goal, Offer/CTA, Audience) — quote a specific headline. The Post goal is strategy (e.g. Awareness, Leads) — NEVER print it or any "LABEL:" prefix on the image. No generic filler like "Boost your brand" or "Real talk over coffee" unless the post ask explicitly requests that scene.
- When Brand Kit is on but logo is off: colors and typography only — NEVER invent logo icons, geometric identity grids, wordmark lockups, circular badges, floating brand marks, laptop-lid decals, or neon/wall signage beside the subject.`
