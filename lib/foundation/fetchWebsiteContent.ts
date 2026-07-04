import { exaReadSite } from '@/lib/research/exa'
import { normalizeWebsiteUrl } from '@/lib/maya/canonicalWebsite'

export type WebsiteContent = {
  url: string
  title?: string
  text: string
  source: 'direct' | 'exa'
}

async function fetchWebsiteHtml(
  websiteUrl: string,
): Promise<{ status: number; finalUrl: string; html: string }> {
  const res = await fetch(websiteUrl, {
    headers: {
      'User-Agent': 'Agent7even-Foundation-Enrichment/1.0 (+https://www.agent7even.ai)',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })
  const html = await res.text()
  return { status: res.status, finalUrl: res.url, html }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)
}

/** Fetch readable website text — direct fetch first, Exa fallback. */
export async function fetchWebsiteContent(rawUrl: string): Promise<WebsiteContent | null> {
  const websiteUrl = normalizeWebsiteUrl(rawUrl)
  if (!websiteUrl) return null

  try {
    const { finalUrl, html } = await fetchWebsiteHtml(websiteUrl)
    const text = htmlToText(html)
    if (text.length >= 200) {
      return { url: finalUrl, text, source: 'direct' }
    }
  } catch {
    // fall through to Exa
  }

  const exa = await exaReadSite(websiteUrl)
  if (exa?.text?.trim()) {
    return {
      url: exa.url,
      title: exa.title,
      text: exa.text.trim().slice(0, 8000),
      source: 'exa',
    }
  }

  return null
}
