/** Normalise Zernio GET /posts and POST /posts response shapes for the dashboard UI. */

import type { PostType } from '@/lib/social/postConstraints'

export type ZernioPostPlatform = {
  platform: string
  accountId: string
  postType: PostType
  customContent?: string
  username: string
  displayName: string
  status: string
  platformPostUrl: string
}

export type ZernioPostMedia = {
  url: string
  type: string
  thumbnailUrl?: string
}

export type ZernioPostRow = {
  id: string
  title: string
  content: string
  status: string
  scheduledFor: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  timezone: string
  platforms: ZernioPostPlatform[]
  media: ZernioPostMedia[]
  mediaPreviewUrl: string | null
  mediaCount: number
}

export type ZernioPostsPagination = {
  page: number
  limit: number
  total: number
  pages: number
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : v != null ? String(v) : ''
}

function readAccountId(entry: Record<string, unknown>): string {
  const raw = entry.accountId ?? entry.account_id
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    return asString(obj._id ?? obj.id)
  }
  return ''
}

function readAccountField(entry: Record<string, unknown>, key: string): string {
  const raw = entry.accountId ?? entry.account_id
  if (raw && typeof raw === 'object') {
    return asString((raw as Record<string, unknown>)[key])
  }
  return ''
}

function readPostType(entry: Record<string, unknown>): PostType {
  const platformSpecificData = asObject(entry.platformSpecificData ?? entry.platform_specific_data)
  const contentType = asString(entry.postType ?? entry.post_type ?? platformSpecificData.contentType ?? platformSpecificData.content_type)
    .toLowerCase()
  if (contentType === 'reel' || contentType === 'reels') return 'reel'
  if (contentType === 'story' || contentType === 'stories') return 'story'
  return 'feed'
}

function readMediaUrl(row: Record<string, unknown>): string {
  return asString(
    row.url ??
    row.publicUrl ??
    row.public_url ??
    row.thumbnailUrl ??
    row.thumbnail ??
    row.previewUrl ??
    row.preview_url,
  )
}

function mapMediaItems(raw: unknown[]): ZernioPostMedia[] {
  return raw
    .map((item) => {
      const row = asObject(item)
      const url = readMediaUrl(row)
      if (!url) return null
      const thumb = asString(row.thumbnailUrl ?? row.thumbnail ?? row.previewUrl)
      return {
        url,
        type: asString(row.type ?? row.mediaType ?? row.media_type).toLowerCase() || 'image',
        ...(thumb ? { thumbnailUrl: thumb } : {}),
      }
    })
    .filter((m): m is ZernioPostMedia => m !== null)
}

function pickMediaPreviewUrl(media: ZernioPostMedia[]): string | null {
  if (media.length === 0) return null
  const image = media.find(m => m.type === 'image' || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(m.url))
  if (image) return image.thumbnailUrl ?? image.url
  const withThumb = media.find(m => m.thumbnailUrl)
  if (withThumb?.thumbnailUrl) return withThumb.thumbnailUrl
  return media[0]?.url ?? null
}

export function mapZernioPost(raw: unknown): ZernioPostRow | null {
  const obj = asObject(raw)
  const id = asString(obj._id ?? obj.id)
  if (!id) return null

  const platforms = asArray(obj.platforms).map((p) => {
    const row = asObject(p)
    return {
      platform: asString(row.platform).toLowerCase(),
      accountId: readAccountId(row),
      postType: readPostType(row),
      ...(asString(row.customContent ?? row.custom_content) ? { customContent: asString(row.customContent ?? row.custom_content) } : {}),
      username: readAccountField(row, 'username') || readAccountField(row, 'platformUsername'),
      displayName: readAccountField(row, 'displayName') || readAccountField(row, 'name'),
      status: asString(row.status),
      platformPostUrl: asString(
        row.platformPostUrl ?? row.platform_post_url ?? row.permalink ?? row.url,
      ),
    }
  })

  const mediaRaw = asArray(obj.mediaItems ?? obj.media_items ?? obj.media)
  const media = mapMediaItems(mediaRaw)

  return {
    id,
    title: asString(obj.title),
    content: asString(obj.content ?? obj.caption ?? obj.text),
    status: asString(obj.status).toLowerCase() || 'draft',
    scheduledFor: asString(obj.scheduledFor ?? obj.scheduled_for) || null,
    publishedAt: asString(obj.publishedAt ?? obj.published_at ?? obj.publishedTime) || null,
    createdAt: asString(obj.createdAt ?? obj.created_at),
    updatedAt: asString(obj.updatedAt ?? obj.updated_at),
    timezone: asString(obj.timezone ?? obj.timeZone) || 'UTC',
    platforms,
    media,
    mediaPreviewUrl: pickMediaPreviewUrl(media),
    mediaCount: media.length,
  }
}

export function parsePostsList(raw: unknown): { posts: ZernioPostRow[]; pagination: ZernioPostsPagination } {
  const envelope = asObject(raw)
  const nested = asObject(envelope.data ?? envelope.result)
  const postsRaw = asArray(
    Array.isArray(envelope.posts) ? envelope.posts : nested.posts ?? envelope.items,
  )
  const paginationRaw = asObject(envelope.pagination ?? nested.pagination)

  const posts = postsRaw
    .map(mapZernioPost)
    .filter((p): p is ZernioPostRow => p !== null)

  return {
    posts,
    pagination: {
      page: Number(paginationRaw.page ?? 1) || 1,
      limit: Number(paginationRaw.limit ?? posts.length) || 10,
      total: Number(paginationRaw.total ?? posts.length) || 0,
      pages: Number(paginationRaw.pages ?? 1) || 1,
    },
  }
}

export function parseSinglePost(raw: unknown): ZernioPostRow | null {
  const envelope = asObject(raw)
  const post = envelope.post ?? envelope.data ?? raw
  return mapZernioPost(post)
}

/** Read profileId from a Zernio GET /posts/{id} (or list item) payload for tenant ownership checks. */
export function readZernioPostProfileId(raw: unknown): string | null {
  const envelope = asObject(raw)
  const post = asObject(envelope.post ?? envelope.data ?? raw)

  const readField = (field: unknown): string | null => {
    if (typeof field === 'string' && field.trim()) return field.trim()
    if (field && typeof field === 'object') {
      const nested = asString((field as Record<string, unknown>)._id ?? (field as Record<string, unknown>).id)
      return nested || null
    }
    return null
  }

  const topLevel = readField(post.profileId ?? post.profile_id)
  if (topLevel) return topLevel

  for (const entry of asArray(post.platforms)) {
    const row = asObject(entry)
    const account = row.accountId ?? row.account_id
    if (account && typeof account === 'object') {
      const fromAccount = readField((account as Record<string, unknown>).profileId
        ?? (account as Record<string, unknown>).profile_id)
      if (fromAccount) return fromAccount
    }
    const fromPlatform = readField(row.profileId ?? row.profile_id)
    if (fromPlatform) return fromPlatform
  }

  return null
}
