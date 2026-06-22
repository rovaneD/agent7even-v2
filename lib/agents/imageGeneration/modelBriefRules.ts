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
        '- At most ONE headline (under 8 words) plus optionally ONE short stat or CTA.',
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
      ].join('\n')
  }
}

export const GLOBAL_IMAGE_BRIEF_RULES = `## Hard rules (every image option)
- NEVER include hex codes (#RRGGBB), bare hex values, or parentheses like "(#10B981)" in the brief text — image models copy them onto the image as labels.
- NEVER copy Brand Kit color token names (e.g. "Growth Green", "Strategic Slate", "Insight Amber") into the brief — say "brand green accent" or "deep slate" instead.
- NEVER copy font family names or weights (e.g. "Inter weight 700") into the brief — say "bold sans headline" if on-image text is allowed for this model.
- NEVER print hex codes, color token names, swatches, font specs, or design-system legends as visible text in the final image — apply colors/fonts in the render only.
- NEVER invent fake customer testimonials, named people, or unrelated industries (bakery, therapy, retail foot traffic, etc.) unless the post ask explicitly requests that format.
- Stay in the business category described in Foundation — B2B marketing SaaS for this brand, not random small-business stock scenarios.
- No fake UI mockups with gibberish labels or lorem filler in prominent areas.
- On-image copy must be real marketing words only — not brief instructions, model names, or metadata.
- Social POST images only — NEVER brief a logo lockup, wordmark tile, monogram hero, or abstract brand-mark symbol. The company name must not be the main visual; use a post-specific headline about the offer or pain point instead.`
