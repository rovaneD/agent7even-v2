function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/filename="([^"]+)"/)
  return match?.[1] ?? null
}

export async function downloadPostAssetFile(opts: {
  storagePath: string
  filename?: string
  mime?: string
}): Promise<void> {
  const res = await fetch('/api/post-assets/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })

  if (!res.ok) {
    throw new Error('download_failed')
  }

  const blob = await res.blob()
  const filename =
    filenameFromDisposition(res.headers.get('Content-Disposition'))
    ?? opts.filename
    ?? opts.storagePath.split('/').pop()
    ?? 'image.png'

  triggerBlobDownload(blob, filename)
}

export async function downloadImageUrl(url: string, filename?: string): Promise<void> {
  let res: Response
  try {
    res = await fetch(url, { mode: 'cors' })
  } catch {
    res = await fetch('/api/media/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, filename }),
    })
  }

  if (!res.ok) {
    res = await fetch('/api/media/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, filename }),
    })
  }

  if (!res.ok) throw new Error('download_failed')

  const blob = await res.blob()
  const resolvedFilename =
    filenameFromDisposition(res.headers.get('Content-Disposition'))
    ?? filename
    ?? url.split('/').pop()?.split('?')[0]
    ?? 'image.jpg'

  triggerBlobDownload(blob, resolvedFilename)
}
