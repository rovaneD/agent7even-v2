import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('query')

  if (!query) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 })
  }

  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) {
    return NextResponse.json({ error: 'Unsplash not configured' }, { status: 500 })
  }

  const res = await fetch(
    `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`,
    {
      headers: { Authorization: `Client-ID ${key}` },
      next: { revalidate: 3600 },
    }
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'Unsplash fetch failed' }, { status: res.status })
  }

  const data = await res.json()

  if (data.links?.download_location) {
    fetch(data.links.download_location, {
      headers: { Authorization: `Client-ID ${key}` },
    }).catch(() => {})
  }

  return NextResponse.json({
    url: data.urls.regular,
    alt: data.alt_description || query,
    credit: data.user.name,
    creditUrl: `${data.user.links.html}?utm_source=agent7even&utm_medium=referral`,
  })
}
