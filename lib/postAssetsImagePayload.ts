import sharp from 'sharp'

/** OpenRouter/Google inline base64 limit is 5 MB — stay under with headroom. */
export const API_IMAGE_PAYLOAD_MAX_BYTES = 3_800_000

export async function compressImageForApiPayload(
  bytes: Buffer,
  opts?: { maxDimension?: number; maxBytes?: number },
): Promise<{ bytes: Buffer; mime: string }> {
  const maxDimension = opts?.maxDimension ?? 1536
  const maxBytes = opts?.maxBytes ?? API_IMAGE_PAYLOAD_MAX_BYTES

  async function encode(input: ReturnType<typeof sharp>): Promise<Buffer> {
    for (const quality of [88, 82, 76, 70, 64, 58]) {
      const out = await input.clone().jpeg({ quality, mozjpeg: true }).toBuffer()
      if (out.byteLength <= maxBytes) return out
    }
    return input.clone().jpeg({ quality: 52, mozjpeg: true }).toBuffer()
  }

  let pipeline = sharp(bytes).rotate()
  const meta = await pipeline.metadata()
  if ((meta.width ?? 0) > maxDimension || (meta.height ?? 0) > maxDimension) {
    pipeline = pipeline.resize(maxDimension, maxDimension, {
      fit: 'inside',
      withoutEnlargement: true,
    })
  }

  let out = await encode(pipeline)
  if (out.byteLength <= maxBytes) {
    return { bytes: out, mime: 'image/jpeg' }
  }

  pipeline = sharp(bytes)
    .rotate()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })

  out = await encode(pipeline)
  if (out.byteLength > maxBytes) {
    throw new Error('image_too_large_for_api')
  }

  return { bytes: out, mime: 'image/jpeg' }
}

export function assertWithinApiPayloadLimit(bytes: Buffer): void {
  const base64Len = Math.ceil(bytes.byteLength / 3) * 4
  if (base64Len > 5_242_880) {
    throw new Error('image_too_large_for_api')
  }
}
