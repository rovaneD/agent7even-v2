import { AGENT_MODELS } from '@/lib/agents/cost'
import { buildImageContextCapabilityPrompt } from '@/lib/posts/imageContextCapabilities'

export const VISION_CAPTION_MODEL = AGENT_MODELS.sonnet

export function buildImageCaptionSystemAddon(params: {
  companyName: string
  platform: string
  charLimit: number
}): string {
  return `${buildImageContextCapabilityPrompt()}

IMAGE-CONTEXT CAPTION MODE — A post image is attached. This is the exact visual that will be published.

Write ONE social caption for ${params.companyName}. The image is attached — reference what is actually shown, match the mood, and complement it. Do not describe the image literally or list every object.

Channel: ${params.platform}. Keep within ${params.charLimit} characters. Return ONLY the caption text — no headings, no quotes, no markdown.`
}

export {
  captionLimitForPlatform as platformCharLimit,
  primaryPlatformFromTaskInput as primaryPlatformFromInput,
} from '@/lib/social/postConstraints'

export function buildVisionUserMessage(params: {
  textInstruction: string
  imageUrl: string
}): Array<{ type: 'text'; text: string } | { type: 'image'; image: URL }> {
  return [
    { type: 'image', image: new URL(params.imageUrl) },
    { type: 'text', text: params.textInstruction },
  ]
}
