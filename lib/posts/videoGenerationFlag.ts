/** Feature flag — video generation (task spec §7). */
export function isVideoGenerationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VIDEO_GENERATION === 'true'
}
