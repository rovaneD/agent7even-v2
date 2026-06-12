import { readPostMediaRef } from '@/lib/postAssets'

/** Preserve image refs when re-queuing after rejection (input and/or saved output). */
export function buildRequeueTaskInput(
  taskInput: Record<string, unknown>,
  outputContent: Record<string, unknown> | null | undefined,
  rejectionFeedback: string,
): Record<string, unknown> {
  const fromInput = readPostMediaRef(taskInput)
  const fromOutput = readPostMediaRef(outputContent ?? {})
  const media = fromInput.media_storage_path ? fromInput : fromOutput

  return {
    ...taskInput,
    ...(media.media_storage_path ? {
      media_storage_path: media.media_storage_path,
      media_mime: media.media_mime,
      image_caption_mode: true,
    } : {}),
    rejection_feedback: rejectionFeedback,
  }
}
