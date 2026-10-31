'use client'

import { useState } from 'react'

/**
 * Internal test page (internal accounts only; the API returns 404 for everyone else): store a small
 * reference file (soundtrack, photo, short clip, up to 3 MB) and show its storage path, so test renders
 * can use it. Added 2026-10-31 to bring the owner's Signature soundtrack into product-cut tests.
 */
export default function InternalUploadPage() {
  const [status, setStatus] = useState<string>('')
  const [result, setResult] = useState<{ path: string; bytes: number } | null>(null)

  async function onFile(file: File) {
    setResult(null)
    if (file.size > 3 * 1024 * 1024) return setStatus('Too big: 3 MB max.')
    setStatus('Uploading…')
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
      r.onerror = () => reject(r.error)
      r.readAsDataURL(file)
    })
    const type = file.type || (file.name.endsWith('.m4a') ? 'audio/x-m4a' : 'application/octet-stream')
    const res = await fetch('/api/internal/asset-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, contentType: type, base64 }),
    })
    const json = (await res.json().catch(() => ({}))) as { path?: string; bytes?: number; error?: string }
    if (!res.ok || !json.path) return setStatus(`Upload failed: ${json.error ?? res.status}`)
    setStatus('Uploaded.')
    setResult({ path: json.path, bytes: json.bytes ?? file.size })
  }

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="text-lg font-semibold">Internal upload</h1>
      <p className="mt-1 text-sm text-neutral-500">Soundtrack, photo or short clip (mp3, m4a, wav, mp4, mov, png, jpg; up to 3 MB).</p>
      <input
        type="file"
        accept="audio/*,video/mp4,video/quicktime,image/png,image/jpeg"
        className="mt-6 block text-sm"
        onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f) }}
      />
      {status && <p className="mt-4 text-sm">{status}</p>}
      {result && (
        <p className="mt-2 break-all rounded bg-neutral-100 p-3 font-mono text-xs" data-upload-path={result.path}>
          {result.path} ({Math.round(result.bytes / 1024)} KB)
        </p>
      )}
    </div>
  )
}
