import { generateText } from 'ai'
import { openrouter } from '@/lib/ai/client'
import { buildVisionUserMessageFromStorage, VISION_CAPTION_MODEL } from '@/lib/agents/visionCaption'

const SCENE_CAPTION_PROMPT = `Describe this marketing image for an image-generation brief.

Focus ONLY on the visual scene:
- People (appearance, pose, expression, clothing)
- Setting, props, and background
- Lighting, color mood, composition, and camera angle
- Where headline/CTA areas sit in the layout (top, center, bottom) — but do NOT quote any text

Ignore all on-image text, headlines, button labels, and watermarks.
Return 2–4 sentences of plain prose — no markdown.`

/** Vision-describe source image scene (no text) for text-only Recraft re-renders. */
export async function describeSceneForTextEdit(storagePath: string): Promise<string | null> {
  try {
    const visionContent = await buildVisionUserMessageFromStorage({
      textInstruction: SCENE_CAPTION_PROMPT,
      storagePath,
    })
    const result = await generateText({
      model: openrouter(VISION_CAPTION_MODEL),
      messages: [{ role: 'user', content: visionContent }],
      maxOutputTokens: 400,
      temperature: 0.2,
    })
    const text = result.text.trim()
    return text.length >= 20 ? text : null
  } catch {
    return null
  }
}
