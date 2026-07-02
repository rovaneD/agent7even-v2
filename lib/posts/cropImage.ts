import type { Area } from 'react-easy-crop'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', error => reject(error))
    image.crossOrigin = 'anonymous'
    image.src = src
  })
}

/** Client-side crop export — JPEG by default; PNG when preserving alpha. */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: Area,
  opts?: { mime?: 'image/jpeg' | 'image/png'; quality?: number },
): Promise<Blob> {
  const mime = opts?.mime ?? 'image/jpeg'
  const quality = opts?.quality ?? 0.92
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error('export_failed'))
          return
        }
        resolve(blob)
      },
      mime,
      mime === 'image/jpeg' ? quality : undefined,
    )
  })
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('read_failed'))
        return
      }
      resolve(result.includes(',') ? result.split(',')[1]! : result)
    }
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(blob)
  })
}
