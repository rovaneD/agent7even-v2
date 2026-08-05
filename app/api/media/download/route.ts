import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { fetchPublicBinary } from '@/lib/security/fetchPublicBinary'
import { UnsafePublicHttpUrlError, validatePublicHttpsUrl } from '@/lib/security/publicHttpUrl'

type Body = {
  url?: string
  filename?: string
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
  const validated = await validatePublicHttpsUrl(url)
  if (!validated.ok) {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
  }

  try {
    const fetched = await fetchPublicBinary(validated.url)
    if (fetched.status < 200 || fetched.status >= 300) {
      return NextResponse.json({ error: 'fetch_failed' }, { status: 502 })
    }

    const contentType =
      fetched.contentType?.split(';')[0]?.trim() || 'application/octet-stream'
    const filename = (body.filename?.trim() || filenameFromUrl(validated.url, 'post-media')).replace(
      /[^a-zA-Z0-9._-]/g,
      '_',
    )

    return new Response(Buffer.from(fetched.bytes), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    if (err instanceof UnsafePublicHttpUrlError) {
      return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
    }
    return NextResponse.json({ error: 'download_failed' }, { status: 502 })
  }
}
