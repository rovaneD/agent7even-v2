import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

type Body = {
  url?: string
  filename?: string
}

function isPublicHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.local')) return false
    if (/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false
    return true
  } catch {
    return false
  }
}

function filenameFromUrl(url: string, fallback: string): string {
  try {
    const name = new URL(url).pathname.split('/').pop()
    if (name && name.includes('.')) return name.replace(/[^a-zA-Z0-9._-]/g, '_')
  } catch {
    // ignore
  }
  return fallback
}

/** Proxy-download public post media URLs (e.g. Zernio CDN) when browser CORS blocks direct fetch. */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const url = body.url?.trim()
  if (!url || !isPublicHttpsUrl(url)) {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
  }

  try {
    const res = await fetch(url)
    if (!res.ok) {
      return NextResponse.json({ error: 'fetch_failed' }, { status: 502 })
    }

    const bytes = Buffer.from(await res.arrayBuffer())
    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream'
    const filename = (body.filename?.trim() || filenameFromUrl(url, 'post-media')).replace(/[^a-zA-Z0-9._-]/g, '_')

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'download_failed' }, { status: 502 })
  }
}
