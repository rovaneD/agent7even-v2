/** Feature flag — creative generation v1 (creative_generation_handoff.md §9). */
export function isImageGenerationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_IMAGE_GENERATION === 'true'
}
