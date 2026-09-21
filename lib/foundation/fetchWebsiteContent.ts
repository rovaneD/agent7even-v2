import { exaReadSite } from '@/lib/research/exa'
import { normalizeWebsiteUrl } from '@/lib/maya/canonicalWebsite'
import { fetchPublicWebsiteHtml } from '@/lib/security/fetchPublicWebsiteHtml'
import {
  assertPublicWebsiteUrl,
  UnsafeWebsiteUrlError,
} from '@/lib/security/publicWebsiteUrl'

export type WebsiteContent = {
  url: string
  title?: string
  text: string
  source: 'direct' | 'exa'
}

export { UnsafeWebsiteUrlError }

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

  // Fail closed before any network I/O (including Exa fallback).
  const publicWebsiteUrl = await assertPublicWebsiteUrl(websiteUrl)

  try {
    const { finalUrl, html } = await fetchPublicWebsiteHtml(publicWebsiteUrl, {
      userAgent: 'Agent7even-Foundation-Enrichment/1.0 (+https://www.agent7even.ai)',
      timeoutMs: 15000,
    })
    const text = htmlToText(html)
    if (text.length >= 200) {
      return { url: finalUrl, text, source: 'direct' }
    }
  } catch (err) {
    if (err instanceof UnsafeWebsiteUrlError) throw err
    // fall through to Exa
  }

  const exa = await exaReadSite(publicWebsiteUrl)
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
