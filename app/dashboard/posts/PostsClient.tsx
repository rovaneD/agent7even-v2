'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, X, ExternalLink, Trash2, Pencil, Hash, Loader2,
  LayoutGrid, List, ChevronDown, CheckCircle, ImagePlus, Film,
} from 'lucide-react'
import DownloadImageButton from '@/components/media/DownloadImageButton'
import ContentLifecycleBar from '@/components/dashboard/ContentLifecycleBar'
import type { ContentLifecycleCounts } from '@/lib/content/lifecycleCounts'
import type { PostsDataState } from './page'
import type { ZernioPostRow } from '@/lib/social/zernioPostsParse'
import type { ZernioQueueRow } from '@/lib/social/zernioQueuesParse'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildPostsMayaContext } from '@/lib/maya/summaries/phase3Context'
import {
  type PostType,
  captionLimitForPlatform,
  postTypeLabel,
  supportedPostTypes,
  tightestCaptionLimit,
  validatePost,
} from '@/lib/social/postConstraints'
import {
  isMetaOAuthPlatform,
  MetaConnectDisclosureModal,
  SocialMetaConnectNotice,
} from '@/components/social/MetaConnectDisclosure'
import {
  canConnectSocialPlatform,
  platformRequiresGrowthPlus,
  X_CONNECT_GROWTH_GATE_MESSAGE,
} from '@/lib/social/platformGates'

// ── Types ─────────────────────────────────────────────────────────────────────

type PostStatusFilter = 'all' | 'draft' | 'scheduled' | 'published' | 'failed' | 'queued' | 'partial'
type PlatformFilter = 'all' | string
type SortKey = 'scheduled-desc' | 'scheduled-asc' | 'created-desc' | 'created-asc' | 'status' | 'platform'
type PublishMode = 'schedule' | 'now' | 'queue' | 'draft'
type ViewMode = 'grid' | 'list'

type Account = { id: string; platform: string; username: string }

type AttachedMedia = {
  localId: string
  url: string
  type: 'image' | 'video'
  title: string
  previewUrl?: string
  uploading?: boolean
}

const MAX_MEDIA_ITEMS = 10
const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm'

interface Props {
  companyName: string
  plan: string
  dataState: PostsDataState
  zernioProfileId: string | null
  zernioProfileIds: string[]
  zernioConnectedPlatforms: string[]
  accounts: Account[]
  pendingPostApprovalCount?: number
  lifecycleCounts?: ContentLifecycleCounts
}

// ── Platform meta ─────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  twitter: 'X / Twitter',
  x: 'X / Twitter',
  threads: 'Threads',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
  reddit: 'Reddit',
  bluesky: 'Bluesky',
  telegram: 'Telegram',
  snapchat: 'Snapchat',
  gbp: 'Google Business',
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-50 text-blue-700',
  publishing: 'bg-amber-50 text-amber-700',
  published: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  partial: 'bg-amber-50 text-amber-700',
  queued: 'bg-violet-50 text-violet-700',
}

const TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'UTC',
  'Europe/London',
]

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function platformLabel(id: string) {
  return PLATFORM_LABELS[id.toLowerCase()] ?? id
}

function postImageDownloadTarget(post: ZernioPostRow): { url: string; filename: string } | null {
  const image = post.media.find(m => m.type !== 'video')
  const url = image?.url ?? post.mediaPreviewUrl
  if (!url) return null
  const base = post.title?.trim() || `post-${post.id.slice(0, 8)}`
  const safe = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'post-image'
  return { url, filename: `${safe}.jpg` }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PostsClient({
  companyName,
  plan,
  dataState,
  zernioProfileId,
  zernioProfileIds,
  zernioConnectedPlatforms,
  accounts: initialAccounts,
  pendingPostApprovalCount = 0,
  lifecycleCounts,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [posts, setPosts] = useState<ZernioPostRow[]>([])
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [statusFilter, setStatusFilter] = useState<PostStatusFilter>(() => {
    const fromUrl = searchParams.get('status')
    const allowed: PostStatusFilter[] = ['all', 'draft', 'scheduled', 'published', 'failed', 'queued', 'partial']
    return fromUrl && allowed.includes(fromUrl as PostStatusFilter)
      ? (fromUrl as PostStatusFilter)
      : 'all'
  })
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('scheduled-desc')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [activeProfileId, setActiveProfileId] = useState(zernioProfileId ?? '')

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)
  const [metaModalPlatform, setMetaModalPlatform] = useState<string | null>(null)
  const [pendingMetaConnect, setPendingMetaConnect] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [content, setContent] = useState('')
  const [mediaItems, setMediaItems] = useState<AttachedMedia[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [publishMode, setPublishMode] = useState<PublishMode>('schedule')
  const [scheduledLocal, setScheduledLocal] = useState('')
  const [timezone, setTimezone] = useState('America/Los_Angeles')
  const [postTypeByAccount, setPostTypeByAccount] = useState<Record<string, PostType>>({})
  const [customContentByAccount, setCustomContentByAccount] = useState<Record<string, string>>({})
  const [customCaptionOpen, setCustomCaptionOpen] = useState<Record<string, boolean>>({})
  const [selectedQueueId, setSelectedQueueId] = useState('')
  const [queues, setQueues] = useState<ZernioQueueRow[]>([])
  const [validationHints, setValidationHints] = useState<string[]>([])
  const [xUpgradeModal, setXUpgradeModal] = useState(false)

  const isLive = dataState === 'live'

  const selectedAccounts = useMemo(
    () => accounts.filter(a => selectedAccountIds.includes(a.id)),
    [accounts, selectedAccountIds],
  )

  const captionLimit = useMemo(() => {
    const targets = selectedAccounts.map(acct => ({
      platform: acct.platform,
      accountId: acct.id,
      postType: postTypeByAccount[acct.id] ?? 'feed',
    }))
    return tightestCaptionLimit(targets)
  }, [selectedAccounts, postTypeByAccount])

  const composeTargets = useMemo(() => {
    if (!drawerOpen || selectedAccountIds.length === 0) return ''
    return selectedAccounts.map(acct => {
      const postType = postTypeByAccount[acct.id] ?? 'feed'
      let line = `${platformLabel(acct.platform)} @${acct.username} [${postType}]`
      if (customCaptionOpen[acct.id]) {
        const custom = customContentByAccount[acct.id]?.trim()
        if (custom) line += ` custom: ${custom.slice(0, 60)}${custom.length > 60 ? '…' : ''}`
      }
      return line
    }).join('; ')
  }, [
    drawerOpen,
    selectedAccountIds.length,
    selectedAccounts,
    postTypeByAccount,
    customCaptionOpen,
    customContentByAccount,
  ])

  const mediaSummary = useMemo(() => ({
    count: mediaItems.length,
    videoCount: mediaItems.filter(m => m.type === 'video').length,
  }), [mediaItems])

  const mayaContext = useMemo(
    () =>
      buildPostsMayaContext({
        companyName,
        plan,
        dataState,
        connectedPlatforms: zernioConnectedPlatforms,
        accounts,
        posts,
        statusFilter,
        platformFilter,
        drawerOpen,
        publishMode,
        selectedAccountCount: selectedAccountIds.length,
        isEditing: Boolean(editingPostId),
        caption: content,
        captionLimit,
        mediaCount: mediaSummary.count,
        videoCount: mediaSummary.videoCount,
        selectedTargets: composeTargets,
        scheduledLocal,
        timezone,
        queueSelected: Boolean(selectedQueueId),
      }),
    [
      companyName,
      plan,
      dataState,
      zernioConnectedPlatforms,
      accounts,
      posts,
      statusFilter,
      platformFilter,
      drawerOpen,
      publishMode,
      selectedAccountIds.length,
      editingPostId,
      content,
      captionLimit,
      mediaSummary.count,
      mediaSummary.videoCount,
      composeTargets,
      scheduledLocal,
      timezone,
      selectedQueueId,
    ],
  )
  useMayaContext(mayaContext)

  const buildPlatformPayload = useCallback(() => {
    return selectedAccountIds.map(id => {
      const acct = accounts.find(a => a.id === id)
      const platform = acct?.platform ?? 'instagram'
      const postType = postTypeByAccount[id] ?? 'feed'
      const custom = customCaptionOpen[id] ? customContentByAccount[id]?.trim() : ''
      return {
        platform,
        accountId: id,
        postType,
        ...(custom ? { customContent: custom } : {}),
      }
    })
  }, [selectedAccountIds, accounts, postTypeByAccount, customCaptionOpen, customContentByAccount])

  const fetchPosts = useCallback(async () => {
    if (!isLive || !activeProfileId) return
    setLoading(true)
    setError('')
    try {
      const q = new URLSearchParams({
        profileId: activeProfileId,
        sortBy,
        limit: '50',
      })
      if (statusFilter !== 'all' && ['draft', 'scheduled', 'published', 'failed'].includes(statusFilter)) {
        q.set('status', statusFilter)
      }
      if (platformFilter !== 'all') q.set('platform', platformFilter)

      const res = await fetch(`/api/posts?${q}`)
      const json = await res.json()
      if (!res.ok) {
        if (json.error === 'zernio_not_configured') {
          setError('Social publishing is not configured on this server. Contact support if this persists.')
        } else if (json.error === 'zernio_api_error') {
          setError('Could not load your posts. Try again in a moment.')
        } else {
          setError(json.message ?? json.detail ?? json.error ?? 'Failed to load posts')
        }
        return
      }
      let rows = (json.posts ?? []) as ZernioPostRow[]
      if (statusFilter === 'queued') rows = rows.filter(p => p.status === 'queued')
      if (statusFilter === 'partial') rows = rows.filter(p => p.status === 'partial')
      setPosts(rows)
      if (Array.isArray(json.accounts) && json.accounts.length) {
        setAccounts(json.accounts)
      }
    } catch {
      setError('Network error loading posts')
    } finally {
      setLoading(false)
    }
  }, [isLive, activeProfileId, sortBy, statusFilter, platformFilter])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  useEffect(() => {
    if (!drawerOpen || !activeProfileId || !isLive) return
    fetch(`/api/posts/queues?profileId=${encodeURIComponent(activeProfileId)}`)
      .then(res => res.json())
      .then(json => setQueues(Array.isArray(json.queues) ? json.queues : []))
      .catch(() => setQueues([]))
  }, [drawerOpen, activeProfileId, isLive])

  // Live validation hints while composing
  useEffect(() => {
    if (!drawerOpen) {
      setValidationHints([])
      return
    }
    const readyMedia = mediaItems.filter(m => m.url && !m.uploading)
    const hints = validatePost({
      content,
      mediaItems: readyMedia.map(m => ({ type: m.type })),
      mode: publishMode,
      platforms: buildPlatformPayload(),
    })
    setValidationHints(hints)
  }, [drawerOpen, content, mediaItems, publishMode, buildPlatformPayload])

  // OAuth return handling
  useEffect(() => {
    const connected = searchParams.get('zernio_connected')
    const zernioErr = searchParams.get('zernio_error')
    if (connected) {
      setToast(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected`)
      router.replace('/dashboard/posts')
      fetchPosts()
    } else if (zernioErr) {
      setError('Account connection failed. Try again from Connect accounts.')
      router.replace('/dashboard/posts')
    }
  }, [searchParams, router, fetchPosts])

  const toggleAccount = (id: string) => {
    setSelectedAccountIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  const resetDrawerForm = useCallback(() => {
    setContent('')
    setMediaItems(prev => {
      prev.forEach(m => { if (m.previewUrl) URL.revokeObjectURL(m.previewUrl) })
      return []
    })
    setSelectedAccountIds(accounts.length === 1 ? [accounts[0].id] : [])
    setPublishMode('schedule')
    const tomorrow = new Date()
    tomorrow.setHours(tomorrow.getHours() + 2, 0, 0, 0)
    setScheduledLocal(tomorrow.toISOString().slice(0, 16))
    setPostTypeByAccount({})
    setCustomContentByAccount({})
    setCustomCaptionOpen({})
    setSelectedQueueId('')
    setCreateError('')
    setEditingPostId(null)
  }, [accounts])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    resetDrawerForm()
  }, [resetDrawerForm])

  const openCreate = () => {
    resetDrawerForm()
    setDrawerOpen(true)
  }

  const openEdit = useCallback(async (postId: string) => {
    setLoadingEdit(true)
    setCreateError('')
    try {
      const res = await fetch(`/api/posts/${postId}`)
      const json = await res.json()
      if (!res.ok || !json.post) {
        setError('Could not load this post for editing')
        return
      }
      const post = json.post as ZernioPostRow
      setEditingPostId(post.id)
      setContent(post.content ?? '')
      setMediaItems((post.media ?? []).map((m, idx) => ({
        localId: `existing-${idx}-${post.id}`,
        url: m.url,
        type: m.type === 'video' ? 'video' as const : 'image' as const,
        title: m.url.split('/').pop() ?? 'media',
        previewUrl: m.type !== 'video' ? (m.thumbnailUrl ?? m.url) : undefined,
      })))
      const accountIds = post.platforms.map(p => p.accountId).filter(Boolean)
      setSelectedAccountIds(accountIds.length > 0 ? accountIds : (accounts.length === 1 ? [accounts[0].id] : []))
      setTimezone(post.timezone || 'America/Los_Angeles')
      if (post.status === 'draft') {
        setPublishMode('draft')
        setScheduledLocal('')
      } else if (post.scheduledFor) {
        setPublishMode('schedule')
        setScheduledLocal(new Date(post.scheduledFor).toISOString().slice(0, 16))
      } else {
        setPublishMode('draft')
        setScheduledLocal('')
      }
      setDrawerOpen(true)
    } catch {
      setError('Could not load this post for editing')
    } finally {
      setLoadingEdit(false)
    }
  }, [accounts])

  const setAccountPostType = (accountId: string, postType: PostType) => {
    setPostTypeByAccount(prev => ({ ...prev, [accountId]: postType }))
  }

  const removeMedia = (localId: string) => {
    setMediaItems(prev => {
      const item = prev.find(m => m.localId === localId)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter(m => m.localId !== localId)
    })
  }

  const uploadMediaFile = async (file: File) => {
    if (mediaItems.length >= MAX_MEDIA_ITEMS) {
      setCreateError(`Maximum ${MAX_MEDIA_ITEMS} media items per post`)
      return
    }

    const localId = crypto.randomUUID()
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    setMediaItems(prev => [...prev, {
      localId,
      url: '',
      type: file.type.startsWith('video/') ? 'video' : 'image',
      title: file.name,
      previewUrl,
      uploading: true,
    }])
    setCreateError('')

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/posts/media', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        removeMedia(localId)
        setCreateError(json.message ?? json.error ?? 'Media upload failed')
        return
      }
      setMediaItems(prev => prev.map(m =>
        m.localId === localId
          ? { ...m, url: json.url, type: json.type ?? m.type, title: json.title ?? m.title, uploading: false }
          : m,
      ))
    } catch {
      removeMedia(localId)
      setCreateError('Network error uploading media')
    }
  }

  // Deep-link from approval success: /dashboard/posts?edit={postId}
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || !isLive) return
    openEdit(editId).finally(() => {
      router.replace('/dashboard/posts')
    })
  }, [searchParams, isLive, openEdit, router])

  const handleSubmit = async () => {
    if (!activeProfileId && !editingPostId) return
    if (mediaItems.some(m => m.uploading)) {
      setCreateError('Wait for media uploads to finish')
      return
    }
    const readyMedia = mediaItems.filter(m => m.url)
    const platformPayload = buildPlatformPayload()
    const clientErrors = validatePost({
      content,
      mediaItems: readyMedia.map(m => ({ type: m.type })),
      mode: publishMode,
      platforms: platformPayload,
    })
    if (clientErrors.length > 0) {
      setCreateError(clientErrors[0])
      return
    }

    setCreating(true)
    setCreateError('')
    try {
      let scheduledFor: string | undefined
      if (publishMode === 'schedule' && scheduledLocal) {
        scheduledFor = new Date(scheduledLocal).toISOString()
      }

      const mediaPayload = readyMedia.map(m => ({ url: m.url, type: m.type, title: m.title }))

      if (editingPostId) {
        const res = await fetch(`/api/posts/${editingPostId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            platforms: platformPayload,
            scheduledFor,
            timezone,
            mediaItems: mediaPayload,
            publishNow: publishMode === 'now',
            isDraft: publishMode === 'draft',
          }),
        })
        const json = await res.json()
        if (!res.ok) {
          const msg = Array.isArray(json.messages) ? json.messages[0] : json.message ?? json.detail ?? json.error
          setCreateError(msg ?? 'Could not update post')
          return
        }
        closeDrawer()
        setToast(
          publishMode === 'now' ? 'Post published'
            : publishMode === 'draft' ? 'Draft updated'
              : 'Post updated',
        )
        fetchPosts()
        return
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: activeProfileId,
          content,
          platforms: platformPayload,
          mode: publishMode,
          scheduledFor,
          timezone,
          queueId: publishMode === 'queue' && selectedQueueId ? selectedQueueId : undefined,
          mediaItems: mediaPayload,
          requestId: crypto.randomUUID(),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const msg = Array.isArray(json.messages) ? json.messages[0] : json.message ?? json.detail ?? json.error
        setCreateError(msg ?? 'Could not create post')
        return
      }
      closeDrawer()
      setToast(
        publishMode === 'now' ? 'Post published'
          : publishMode === 'draft' ? 'Draft saved'
            : publishMode === 'queue' ? 'Added to queue'
              : 'Post scheduled',
      )
      fetchPosts()
    } catch {
      setCreateError('Network error')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (postId: string) => {
    if (!confirm('Delete this post?')) return
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
    if (res.ok) {
      setToast('Post deleted')
      fetchPosts()
    } else {
      setError('Could not delete post')
    }
  }

  const connectPlatform = async (platform: string) => {
    const res = await fetch('/api/integrations/zernio/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, returnTo: '/dashboard/posts' }),
    })
    const data = await res.json()
    if (data.error === 'growth_plan_required') {
      setXUpgradeModal(true)
      setCreateError(data.message ?? X_CONNECT_GROWTH_GATE_MESSAGE)
      return
    }
    if (data.authUrl) window.location.href = data.authUrl
    else if (data.message || data.error) {
      setCreateError(data.message ?? data.error ?? 'Could not connect that account.')
    }
  }

  const handleConnect = (platform: string) => {
    if (platformRequiresGrowthPlus(platform) && !canConnectSocialPlatform(plan, platform)) {
      setXUpgradeModal(true)
      return
    }
    if (isMetaOAuthPlatform(platform) && !pendingMetaConnect) {
      setMetaModalPlatform(platform)
      return
    }
    setPendingMetaConnect(false)
    void connectPlatform(platform)
  }

  const platformOptions = useMemo(() => {
    const set = new Set(accounts.map(a => a.platform))
    zernioConnectedPlatforms.forEach(p => set.add(p))
    return Array.from(set).filter(Boolean)
  }, [accounts, zernioConnectedPlatforms])

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-text">Posts</h1>
          <p className="text-[14px] text-text-sec mt-1">Manage your scheduled and published content</p>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-medium text-text-sec border border-gray-200 rounded-xl px-4 py-2.5 hover:border-gray-300 transition-colors"
            >
              Connect accounts
            </button>
          )}
          <button
            type="button"
            disabled={!isLive}
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 bg-[#3B82F6] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
          >
            <Plus size={16} /> Create post
          </button>
        </div>
      </div>

      {lifecycleCounts && (
        <ContentLifecycleBar counts={lifecycleCounts} compact />
      )}

      {toast && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
          <CheckCircle size={16} /> {toast}
          <button type="button" className="ml-auto text-emerald-600" onClick={() => setToast('')}><X size={14} /></button>
        </div>
      )}

      {pendingPostApprovalCount > 0 && (
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[13px] text-blue-900">
          {pendingPostApprovalCount === 1
            ? 'You have a new post waiting in Approvals. Approve it there first — this page only lists scheduled and published drafts after approval.'
            : `You have ${pendingPostApprovalCount} posts waiting in Approvals. Approve them there first — this page only lists scheduled and published drafts after approval.`}{' '}
          <Link href="/dashboard/agents/approvals?queue=post" className="font-semibold text-[#3B82F6] hover:underline">
            Open Posts to review
          </Link>
        </div>
      )}

      {dataState === 'mock' && (
        <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          Demo mode — activate a paid plan to schedule and publish through connected social accounts.
        </div>
      )}

      {dataState === 'empty' && (
        <EmptyConnectState onConnect={() => setConnectOpen(true)} />
      )}

      {isLive && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <FilterSelect value={statusFilter} onChange={v => setStatusFilter(v as PostStatusFilter)} options={[
              { value: 'all', label: 'All posts' },
              { value: 'draft', label: 'Draft' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'queued', label: 'Queued' },
              { value: 'published', label: 'Published' },
              { value: 'failed', label: 'Failed' },
              { value: 'partial', label: 'Partial' },
            ]} />
            <FilterSelect value={platformFilter} onChange={v => setPlatformFilter(v)} options={[
              { value: 'all', label: 'All platforms' },
              ...platformOptions.map(p => ({ value: p, label: platformLabel(p) })),
            ]} />
            {zernioProfileIds.length > 1 && (
              <FilterSelect value={activeProfileId} onChange={setActiveProfileId} options={
                zernioProfileIds.map(id => ({ value: id, label: id.slice(0, 8) + '…' }))
              } />
            )}
            <div className="ml-auto flex items-center gap-2">
              <FilterSelect value={sortBy} onChange={v => setSortBy(v as SortKey)} options={[
                { value: 'scheduled-desc', label: 'Scheduled (newest)' },
                { value: 'scheduled-asc', label: 'Scheduled (oldest)' },
                { value: 'created-desc', label: 'Created (newest)' },
                { value: 'created-asc', label: 'Created (oldest)' },
                { value: 'status', label: 'Status' },
                { value: 'platform', label: 'Platform' },
              ]} />
              <button type="button" onClick={() => setViewMode('grid')} className={`p-2 rounded-lg border ${viewMode === 'grid' ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-gray-200 text-text-soft'}`} aria-label="Grid view">
                <LayoutGrid size={16} />
              </button>
              <button type="button" onClick={() => setViewMode('list')} className={`p-2 rounded-lg border ${viewMode === 'list' ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-gray-200 text-text-soft'}`} aria-label="List view">
                <List size={16} />
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24 text-text-soft">
              <Loader2 size={24} className="animate-spin mr-2" /> Loading posts…
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Pencil size={22} className="text-gray-400" />
              </div>
              <p className="text-[16px] font-semibold text-text mb-1">No posts yet</p>
              <p className="text-[13px] text-text-soft mb-5">Create your first social media post</p>
              <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 bg-[#3B82F6] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl">
                <Plus size={16} /> Create post
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {posts.map(post => (
                <PostCard key={post.id} post={post} onDelete={handleDelete} onEdit={openEdit} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden divide-y divide-gray-50">
              {posts.map(post => (
                <PostListRow key={post.id} post={post} onDelete={handleDelete} onEdit={openEdit} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create drawer */}
      {drawerOpen && (
        <CreatePostDrawer
          isEditing={!!editingPostId}
          content={content}
          onContentChange={setContent}
          captionLimit={captionLimit}
          mediaItems={mediaItems}
          onMediaSelect={uploadMediaFile}
          onMediaRemove={removeMedia}
          accounts={accounts}
          selectedAccountIds={selectedAccountIds}
          onToggleAccount={toggleAccount}
          postTypeByAccount={postTypeByAccount}
          onPostTypeChange={setAccountPostType}
          customContentByAccount={customContentByAccount}
          onCustomContentChange={(id, value) =>
            setCustomContentByAccount(prev => ({ ...prev, [id]: value }))
          }
          customCaptionOpen={customCaptionOpen}
          onCustomCaptionToggle={(id, open) =>
            setCustomCaptionOpen(prev => ({ ...prev, [id]: open }))
          }
          publishMode={publishMode}
          onPublishModeChange={setPublishMode}
          scheduledLocal={scheduledLocal}
          onScheduledLocalChange={setScheduledLocal}
          timezone={timezone}
          onTimezoneChange={setTimezone}
          queues={queues}
          selectedQueueId={selectedQueueId}
          onQueueChange={setSelectedQueueId}
          validationHints={validationHints}
          creating={creating || loadingEdit}
          error={createError}
          onClose={closeDrawer}
          onSubmit={handleSubmit}
        />
      )}

      {/* Connect panel */}
      <MetaConnectDisclosureModal
        open={Boolean(metaModalPlatform)}
        platform={metaModalPlatform}
        onCancel={() => setMetaModalPlatform(null)}
        onContinue={() => {
          const platform = metaModalPlatform
          setMetaModalPlatform(null)
          if (!platform) return
          setPendingMetaConnect(true)
          void connectPlatform(platform)
        }}
      />
      {connectOpen && (
        <ConnectPanel
          plan={plan}
          connectedPlatforms={zernioConnectedPlatforms}
          onClose={() => setConnectOpen(false)}
          onConnect={handleConnect}
        />
      )}

      {xUpgradeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="text-[15px] font-semibold text-text mb-1">Upgrade to connect X</p>
            <p className="text-[13px] text-text-sec mb-4 leading-relaxed">
              {X_CONNECT_GROWTH_GATE_MESSAGE} Instagram, Facebook, TikTok, YouTube, and LinkedIn remain available on Starter.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setXUpgradeModal(false)}
                className="flex-1 border border-gray-200 text-sm font-medium text-text-sec px-4 py-2 rounded-xl hover:border-gray-300 transition-colors"
              >
                Not now
              </button>
              <a
                href="/dashboard/billing"
                className="flex-1 bg-[#3B82F6] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#2563EB] transition-colors text-center"
              >
                View plans
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-[13px] text-text-sec hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-soft pointer-events-none" />
    </div>
  )
}

function EmptyConnectState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white py-20 text-center">
      <p className="text-[16px] font-semibold text-text mb-1">Connect your social accounts</p>
      <p className="text-[13px] text-text-soft mb-5 max-w-md mx-auto">
        Link Instagram, Facebook, and other platforms to schedule and publish from Maya.
      </p>
      <button type="button" onClick={onConnect} className="inline-flex items-center gap-1.5 bg-[#3B82F6] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl">
        Connect accounts
      </button>
    </div>
  )
}

function PostMediaPreview({
  post,
  variant = 'card',
}: {
  post: ZernioPostRow
  variant?: 'card' | 'thumb'
}) {
  const preview = post.mediaPreviewUrl
  if (!preview) return null

  const isVideo = post.media.some(m => m.type === 'video')

  if (variant === 'thumb') {
    return (
      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="" className="w-full h-full object-cover" />
        {isVideo && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <Film size={14} className="text-white" />
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="relative aspect-[4/5] max-h-48 overflow-hidden bg-gray-100 border-b border-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt="" className="w-full h-full object-cover" />
      {isVideo && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/20">
          <span className="rounded-full bg-black/50 p-2">
            <Film size={18} className="text-white" />
          </span>
        </span>
      )}
      {post.mediaCount > 1 && (
        <span className="absolute top-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          +{post.mediaCount - 1}
        </span>
      )}
    </div>
  )
}

function PostCard({
  post, onDelete, onEdit,
}: {
  post: ZernioPostRow
  onDelete: (id: string) => void
  onEdit: (id: string) => void
}) {
  const url = post.platforms.find(p => p.platformPostUrl)?.platformPostUrl
  const canModify = ['draft', 'scheduled', 'failed'].includes(post.status)
  const showPublishedTime = post.status === 'published' || post.status === 'publishing'
  const downloadTarget = postImageDownloadTarget(post)

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden flex flex-col">
      <PostMediaPreview post={post} />
      <div className="p-4 flex flex-col flex-1 min-h-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLES[post.status] ?? STATUS_STYLES.draft}`}>
            {post.status}
          </span>
          <div className="flex gap-1">
            {downloadTarget && (
              <DownloadImageButton
                url={downloadTarget.url}
                filename={downloadTarget.filename}
                label="Download image"
                iconOnly
                className="p-1.5 text-text-soft hover:text-blue-600 bg-transparent shadow-none hover:bg-transparent"
              />
            )}
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className="p-1.5 text-text-soft hover:text-blue-600" aria-label="View post">
                <ExternalLink size={14} />
              </a>
            )}
            {canModify && (
              <button type="button" onClick={() => onEdit(post.id)} className="p-1.5 text-text-soft hover:text-blue-600" aria-label="Edit post">
                <Pencil size={14} />
              </button>
            )}
            {canModify && (
              <button type="button" onClick={() => onDelete(post.id)} className="p-1.5 text-text-soft hover:text-red-600" aria-label="Delete post">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        <p className="text-[13px] text-text line-clamp-3 flex-1 mb-3">{post.content || (post.mediaCount ? '(Media post)' : '(No caption)')}</p>
        {!post.mediaPreviewUrl && post.mediaCount > 0 && (
          <p className="text-[11px] text-text-soft mb-2 flex items-center gap-1">
            <Film size={12} /> {post.mediaCount} media
          </p>
        )}
        <div className="flex flex-wrap gap-1 mb-2">
          {post.platforms.map(p => (
            <span key={`${p.platform}-${p.accountId}`} className="text-[10px] bg-gray-50 border border-gray-100 rounded-md px-1.5 py-0.5 text-text-soft">
              {platformLabel(p.platform)}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-text-soft mt-auto">
          {showPublishedTime ? fmtDate(post.publishedAt) : fmtDate(post.scheduledFor)}
        </p>
      </div>
    </div>
  )
}

function PostListRow({
  post, onDelete, onEdit,
}: {
  post: ZernioPostRow
  onDelete: (id: string) => void
  onEdit: (id: string) => void
}) {
  const url = post.platforms.find(p => p.platformPostUrl)?.platformPostUrl
  const canModify = ['draft', 'scheduled', 'failed'].includes(post.status)
  const showPublishedTime = post.status === 'published' || post.status === 'publishing'
  const downloadTarget = postImageDownloadTarget(post)

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50">
      <PostMediaPreview post={post} variant="thumb" />
      <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLES[post.status] ?? STATUS_STYLES.draft}`}>
        {post.status}
      </span>
      <p className="text-[13px] text-text flex-1 truncate">{post.content || (post.mediaCount ? '(Media post)' : '(No caption)')}</p>
      <p className="text-[11px] text-text-soft w-36 hidden md:block">
        {showPublishedTime ? fmtDate(post.publishedAt) : fmtDate(post.scheduledFor)}
      </p>
      <div className="flex gap-1">
        {downloadTarget && (
          <DownloadImageButton
            url={downloadTarget.url}
            filename={downloadTarget.filename}
            label="Download image"
            iconOnly
            className="p-1.5 text-text-soft hover:text-blue-600 bg-transparent shadow-none hover:bg-transparent"
          />
        )}
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="p-1.5 text-text-soft hover:text-blue-600">
            <ExternalLink size={14} />
          </a>
        )}
        {canModify && (
          <button type="button" onClick={() => onEdit(post.id)} className="p-1.5 text-text-soft hover:text-blue-600" aria-label="Edit post">
            <Pencil size={14} />
          </button>
        )}
        {canModify && (
          <button type="button" onClick={() => onDelete(post.id)} className="p-1.5 text-text-soft hover:text-red-600" aria-label="Delete post">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

function CreatePostDrawer({
  isEditing,
  content, onContentChange, captionLimit, mediaItems, onMediaSelect, onMediaRemove,
  accounts, selectedAccountIds, onToggleAccount,
  postTypeByAccount, onPostTypeChange,
  customContentByAccount, onCustomContentChange,
  customCaptionOpen, onCustomCaptionToggle,
  publishMode, onPublishModeChange, scheduledLocal, onScheduledLocalChange,
  timezone, onTimezoneChange,
  queues, selectedQueueId, onQueueChange,
  validationHints, creating, error, onClose, onSubmit,
}: {
  isEditing?: boolean
  content: string
  onContentChange: (v: string) => void
  captionLimit: number | null
  mediaItems: AttachedMedia[]
  onMediaSelect: (file: File) => void
  onMediaRemove: (localId: string) => void
  accounts: Account[]
  selectedAccountIds: string[]
  onToggleAccount: (id: string) => void
  postTypeByAccount: Record<string, PostType>
  onPostTypeChange: (accountId: string, postType: PostType) => void
  customContentByAccount: Record<string, string>
  onCustomContentChange: (accountId: string, value: string) => void
  customCaptionOpen: Record<string, boolean>
  onCustomCaptionToggle: (accountId: string, open: boolean) => void
  publishMode: PublishMode
  onPublishModeChange: (m: PublishMode) => void
  scheduledLocal: string
  onScheduledLocalChange: (v: string) => void
  timezone: string
  onTimezoneChange: (v: string) => void
  queues: ZernioQueueRow[]
  selectedQueueId: string
  onQueueChange: (id: string) => void
  validationHints: string[]
  creating: boolean
  error: string
  onClose: () => void
  onSubmit: () => void
}) {
  const mediaUploading = mediaItems.some(m => m.uploading)
  const overCaptionLimit = captionLimit != null && content.length > captionLimit
  const modes: { id: PublishMode; label: string }[] = [
    { id: 'schedule', label: 'Schedule' },
    { id: 'now', label: 'Now' },
    { id: 'queue', label: 'Queue' },
    { id: 'draft', label: 'Draft' },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-[16px] font-semibold text-text">{isEditing ? 'Edit Post' : 'Create Post'}</h2>
            <p className="text-[12px] text-text-soft">
              {isEditing ? 'Update caption, media, or schedule' : 'Create & publish content'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-text-soft hover:text-text"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-2 block">Caption</label>
            <textarea
              value={content}
              onChange={e => onContentChange(e.target.value)}
              placeholder="What's on your mind…"
              rows={5}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] text-text resize-none focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <p className={`text-[11px] mt-1 ${overCaptionLimit ? 'text-red-600 font-medium' : 'text-text-soft'}`}>
              {content.length.toLocaleString()}
              {captionLimit != null ? ` / ${captionLimit.toLocaleString()}` : ''} chars
              {selectedAccountIds.length > 1 && captionLimit != null ? ' (tightest selected platform)' : ''}
            </p>

            {mediaItems.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {mediaItems.map(item => (
                  <div key={item.localId} className="relative aspect-square rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                    {item.type === 'image' && (item.previewUrl || item.url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.previewUrl ?? item.url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-text-soft gap-1 p-2">
                        <Film size={18} />
                        <span className="text-[9px] text-center line-clamp-2">{item.title}</span>
                      </div>
                    )}
                    {item.uploading && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                        <Loader2 size={18} className="animate-spin text-blue-600" />
                      </div>
                    )}
                    {!item.uploading && (
                      <>
                        {item.type === 'image' && (item.previewUrl || item.url) && (
                          <DownloadImageButton
                            url={item.url || item.previewUrl}
                            filename={item.title}
                            label="Download image"
                            iconOnly
                            className="absolute left-1 top-1 bg-black/50 text-white shadow-none hover:bg-black/70"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => onMediaRemove(item.localId)}
                          className="absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white hover:bg-black/70"
                          aria-label="Remove media"
                        >
                          <X size={12} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {mediaItems.length < MAX_MEDIA_ITEMS && (
              <label className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-3 text-[13px] font-medium text-text-sec hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors">
                <ImagePlus size={16} />
                Add media
                <input
                  type="file"
                  accept={MEDIA_ACCEPT}
                  className="sr-only"
                  disabled={mediaUploading}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) onMediaSelect(file)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
            <p className="text-[10px] text-text-soft mt-1.5">
              JPG, PNG, WebP, GIF · MP4, MOV, WebM · up to {MAX_MEDIA_ITEMS} files
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-2 block">Platforms</label>
            <div className="space-y-2">
              {accounts.length === 0 ? (
                <p className="text-[13px] text-text-soft">No connected accounts — connect one first.</p>
              ) : accounts.map(acct => {
                const selected = selectedAccountIds.includes(acct.id)
                return (
                  <button
                    key={acct.id}
                    type="button"
                    onClick={() => onToggleAccount(acct.id)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      {acct.platform === 'instagram' ? <Hash size={16} className="text-pink-600" /> : <span className="text-[10px] font-bold uppercase">{acct.platform.slice(0, 2)}</span>}
                    </span>
                    <span>
                      <span className="block text-[13px] font-medium text-text">{platformLabel(acct.platform)}</span>
                      <span className="block text-[11px] text-text-soft">@{acct.username}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {selectedAccountIds.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft">Per-platform settings</p>
                {selectedAccountIds.map(id => {
                  const acct = accounts.find(a => a.id === id)
                  if (!acct) return null
                  const types = supportedPostTypes(acct.platform)
                  const postType = postTypeByAccount[id] ?? 'feed'
                  const limit = captionLimitForPlatform(acct.platform)
                  const customOpen = customCaptionOpen[id] ?? false
                  const customValue = customContentByAccount[id] ?? ''
                  const customOver = customOpen && customValue.length > limit

                  return (
                    <div key={id} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-text">{platformLabel(acct.platform)} · @{acct.username}</span>
                      </div>

                      {types.length > 1 && (
                        <div className="flex flex-wrap gap-1">
                          {types.map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => onPostTypeChange(id, type)}
                              className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                                postType === type
                                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 bg-white text-text-sec hover:border-gray-300'
                              }`}
                            >
                              {postTypeLabel(type)}
                            </button>
                          ))}
                        </div>
                      )}

                      {postType === 'story' && acct.platform === 'instagram' && (
                        <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                          Instagram Stories don&apos;t display captions in the feed.
                        </p>
                      )}

                      {postType === 'reel' && !mediaItems.some(m => m.type === 'video' && m.url) && (
                        <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                          Reels require a video upload.
                        </p>
                      )}

                      <label className="flex items-center gap-2 text-[11px] text-text-sec cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customOpen}
                          onChange={e => onCustomCaptionToggle(id, e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        Custom caption for {platformLabel(acct.platform)}
                      </label>

                      {customOpen && (
                        <>
                          <textarea
                            value={customValue}
                            onChange={e => onCustomContentChange(id, e.target.value)}
                            placeholder={`Caption for ${platformLabel(acct.platform)} only…`}
                            rows={3}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] text-text resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white"
                          />
                          <p className={`text-[10px] ${customOver ? 'text-red-600' : 'text-text-soft'}`}>
                            {customValue.length.toLocaleString()} / {limit.toLocaleString()} chars
                          </p>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-text-soft mb-2 block">Publishing</label>
            <div className="flex rounded-xl border border-gray-200 p-1 gap-1 mb-3">
              {modes.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onPublishModeChange(m.id)}
                  className={`flex-1 text-[12px] font-medium py-1.5 rounded-lg transition-colors ${publishMode === m.id ? 'bg-[#3B82F6] text-white' : 'text-text-sec hover:bg-gray-50'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {publishMode === 'schedule' && (
              <div className="space-y-2">
                <input
                  type="datetime-local"
                  value={scheduledLocal}
                  onChange={e => onScheduledLocalChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <select
                  value={timezone}
                  onChange={e => onTimezoneChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            )}

            {publishMode === 'queue' && (
              <div className="space-y-2">
                {queues.length > 1 ? (
                  <select
                    value={selectedQueueId}
                    onChange={e => onQueueChange(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Default queue</option>
                    {queues.map(q => (
                      <option key={q.id} value={q.id}>
                        {q.name}{q.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[12px] text-text-soft bg-gray-50 rounded-xl px-3 py-2">
                    {queues[0]
                      ? `Uses queue: ${queues[0].name}${queues[0].isDefault ? ' (default)' : ''}`
                      : 'Adds to your default queue for the next available slot.'}
                  </p>
                )}
              </div>
            )}
          </div>

          {validationHints.length > 0 && (
            <ul className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 space-y-1">
              {validationHints.map(hint => (
                <li key={hint} className="text-[11px] text-amber-900">{hint}</li>
              ))}
            </ul>
          )}

          {error && <p className="text-[13px] text-red-600">{error}</p>}
        </div>

        <div className="border-t border-gray-100 px-5 py-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-[13px] font-medium text-text-sec py-2.5 rounded-xl hover:border-gray-300">
            Cancel
          </button>
          <button
            type="button"
            disabled={creating || mediaUploading || validationHints.length > 0}
            onClick={onSubmit}
            className="flex-1 bg-[#3B82F6] text-white text-[13px] font-semibold py-2.5 rounded-xl hover:bg-[#2563EB] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {creating && <Loader2 size={14} className="animate-spin" />}
            {isEditing
              ? (publishMode === 'now' ? 'Publish now'
                : publishMode === 'draft' ? 'Save draft'
                  : publishMode === 'queue' ? 'Add to queue'
                    : 'Save changes')
              : (publishMode === 'now' ? 'Publish now'
                : publishMode === 'draft' ? 'Save draft'
                  : publishMode === 'queue' ? 'Add to queue'
                    : 'Schedule post')}
          </button>
        </div>
      </aside>
    </>
  )
}

function ConnectPanel({
  plan, connectedPlatforms, onClose, onConnect,
}: {
  plan: string
  connectedPlatforms: string[]
  onClose: () => void
  onConnect: (platform: string) => void
}) {
  const platforms = ['instagram', 'facebook', 'tiktok', 'linkedin', 'x', 'threads', 'pinterest', 'youtube']

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[16px] font-semibold text-text">Connect accounts</h2>
          <button type="button" onClick={onClose}><X size={18} className="text-text-soft" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          <SocialMetaConnectNotice className="mb-4" />
          {platforms.map(p => {
            const connected = connectedPlatforms.includes(p)
            const xGrowthGated = p === 'x' && !connected && !canConnectSocialPlatform(plan, p)
            return (
              <div key={p} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
                <div>
                  <span className="text-[13px] font-medium text-text">{platformLabel(p)}</span>
                  {xGrowthGated && (
                    <p className="text-[11px] text-text-soft mt-0.5">Growth or ProAgent</p>
                  )}
                </div>
                {connected ? (
                  <span className="text-[11px] font-semibold text-emerald-600">Connected</span>
                ) : xGrowthGated ? (
                  <a href="/dashboard/billing" className="text-[12px] font-semibold text-[#3B82F6] hover:underline">
                    Upgrade
                  </a>
                ) : (
                  <button type="button" onClick={() => onConnect(p)} className="text-[12px] font-semibold text-[#3B82F6] hover:underline">
                    Connect
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}
