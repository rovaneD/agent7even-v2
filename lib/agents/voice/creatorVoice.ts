import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { openRouterSpeech } from './openRouterSpeech'

/**
 * A creator's speech: Fish Audio Drama 3 via OpenRouter copies the creator's voice sample for every
 * line. Owner picked this over saving ElevenLabs voices (2026-10-23): same voice by ear, no per-account
 * voice-slot limit, and it works the same for customers' own creators.
 * OpenRouter's ElevenLabs models only accept their stock voices, and Voxtral / ElevenLabs on OpenRouter
 * have no voice-copy endpoint (tested 2026-10-23).
 */
export const CREATOR_VOICE_MODEL = 'fish-audio/drama-3'

export async function speakAsCreator(opts: { voiceSamplePath: string; text: string }): Promise<Buffer> {
  const sampleUrl = await createPostAssetSignedUrl(opts.voiceSamplePath, 60 * 30)
  if (!sampleUrl) throw new Error('voice_sample_unavailable')
  return openRouterSpeech({
    model: CREATOR_VOICE_MODEL,
    input: opts.text,
    inputReferences: [{ type: 'input_audio', input_audio: { url: sampleUrl } }],
  })
}
