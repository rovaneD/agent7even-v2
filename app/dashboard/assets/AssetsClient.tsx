'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bookmark,
  Folder,
  FolderPlus,
  Heart,
  Images,
  Loader2,
  Send,
  Trash2,
} from 'lucide-react'
import DownloadImageButton from '@/components/media/DownloadImageButton'
import AssetPreviewModal from './AssetPreviewModal'
import type { CreativeAssetFolderRow, CreativeAssetWithUrl } from '@/lib/creativeAssets'

type Props = {
  companyName: string
  initialAssets: CreativeAssetWithUrl[]
  initialFolders: CreativeAssetFolderRow[]
}

type FolderFilter = 'all' | 'uncategorized' | 'favorites' | string

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function AssetsClient({
  companyName,
  initialAssets,
  initialFolders,
}: Props) {
  const [assets, setAssets] = useState(initialAssets)
  const [folders, setFolders] = useState(initialFolders)
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderError, setFolderError] = useState<string | null>(null)
  const [savingFolder, setSavingFolder] = useState(false)
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null)
  const [movingAssetId, setMovingAssetId] = useState<string | null>(null)
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null)

  const previewAsset = useMemo(
    () => assets.find(a => a.id === previewAssetId) ?? null,
    [assets, previewAssetId],
  )

  useEffect(() => {
    if (!previewAssetId) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPreviewAssetId(null)
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [previewAssetId])

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const asset of assets) {
      if (asset.folder_id) {
        counts.set(asset.folder_id, (counts.get(asset.folder_id) ?? 0) + 1)
      }
    }
    return counts
  }, [assets])

  const filtered = useMemo(() => {
    return assets.filter(asset => {
      if (folderFilter === 'favorites') return asset.is_favorite
      if (folderFilter === 'uncategorized') return !asset.folder_id
      if (folderFilter === 'all') return true
      return asset.folder_id === folderFilter
    })
  }, [assets, folderFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, CreativeAssetWithUrl[]>()
    for (const asset of filtered) {
      const day = formatDay(asset.created_at)
      const list = map.get(day) ?? []
      list.push(asset)
      map.set(day, list)
    }
    return [...map.entries()]
  }, [filtered])

  async function toggleFavorite(asset: CreativeAssetWithUrl) {
    const next = !asset.is_favorite
    setAssets(prev =>
      prev.map(a => (a.id === asset.id ? { ...a, is_favorite: next } : a)),
    )
    await fetch(`/api/creative-assets/${asset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: next }),
    })
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault()
    const name = newFolderName.trim()
    if (!name || savingFolder) return

    setSavingFolder(true)
    setFolderError(null)
    try {
      const res = await fetch('/api/creative-asset-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFolderError(
          (typeof data.message === 'string' ? data.message : null)
          ?? 'Could not create folder.',
        )
        return
      }
      const folder = data.folder as CreativeAssetFolderRow
      setFolders(prev => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)))
      setFolderFilter(folder.id)
      setNewFolderName('')
      setCreatingFolder(false)
    } finally {
      setSavingFolder(false)
    }
  }

  async function deleteFolder(folderId: string, folderName: string) {
    if (!confirm(`Delete folder "${folderName}"? Images inside will move to Uncategorized.`)) return

    const res = await fetch(`/api/creative-asset-folders/${folderId}`, { method: 'DELETE' })
    if (!res.ok) return

    setFolders(prev => prev.filter(f => f.id !== folderId))
    setAssets(prev =>
      prev.map(a => (a.folder_id === folderId ? { ...a, folder_id: null } : a)),
    )
    if (folderFilter === folderId) setFolderFilter('all')
  }

  async function moveAsset(asset: CreativeAssetWithUrl, folderId: string | null) {
    setMovingAssetId(asset.id)
    const previousFolderId = asset.folder_id
    setAssets(prev =>
      prev.map(a => (a.id === asset.id ? { ...a, folder_id: folderId } : a)),
    )

    const res = await fetch(`/api/creative-assets/${asset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    })

    if (!res.ok) {
      setAssets(prev =>
        prev.map(a => (a.id === asset.id ? { ...a, folder_id: previousFolderId } : a)),
      )
    }
    setMovingAssetId(null)
  }

  async function deleteAsset(asset: CreativeAssetWithUrl) {
    if (!confirm('Remove this image from your asset library?')) return

    setDeletingAssetId(asset.id)
    const res = await fetch(`/api/creative-assets/${asset.id}`, { method: 'DELETE' })
    if (res.ok) {
      setAssets(prev => prev.filter(a => a.id !== asset.id))
      if (previewAssetId === asset.id) setPreviewAssetId(null)
    }
    setDeletingAssetId(null)
  }

  const activeFolderName =
    folderFilter === 'all'
      ? 'All assets'
      : folderFilter === 'uncategorized'
        ? 'Uncategorized'
        : folderFilter === 'favorites'
          ? 'Favorites'
          : folders.find(f => f.id === folderFilter)?.name ?? 'Folder'

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Assets</h1>
          <p className="mt-1 text-sm text-text-sec">
            Saved generations for {companyName || 'your workspace'}. Organize in folders or use for posts.
          </p>
        </div>
        <Link
          href="/dashboard/agents"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-[#2563EB]"
        >
          Generate more
        </Link>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-56 flex-shrink-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
            Folders
          </p>
          <div className="space-y-1 rounded-2xl border border-gray-100 bg-white p-2">
            {([
              ['all', 'All assets', assets.length],
              ['uncategorized', 'Uncategorized', assets.filter(a => !a.folder_id).length],
              ['favorites', 'Favorites', assets.filter(a => a.is_favorite).length],
            ] as const).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFolderFilter(id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  folderFilter === id
                    ? 'bg-brand-primary/10 font-semibold text-brand-primary'
                    : 'text-text-sec hover:bg-gray-50'
                }`}
              >
                <span>{label}</span>
                <span className="text-xs text-text-soft">{count}</span>
              </button>
            ))}

            {folders.map(folder => (
              <div key={folder.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFolderFilter(folder.id)}
                  className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    folderFilter === folder.id
                      ? 'bg-brand-primary/10 font-semibold text-brand-primary'
                      : 'text-text-sec hover:bg-gray-50'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Folder size={14} className="flex-shrink-0" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  <span className="text-xs text-text-soft">{folderCounts.get(folder.id) ?? 0}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void deleteFolder(folder.id, folder.name)}
                  className="rounded-md p-1.5 text-text-soft opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                  aria-label={`Delete folder ${folder.name}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {creatingFolder ? (
              <form onSubmit={e => void createFolder(e)} className="border-t border-gray-100 px-2 pt-2">
                <input
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  autoFocus
                  className="mb-2 w-full rounded-lg border border-border px-2.5 py-2 text-sm outline-none focus:border-brand-primary"
                />
                {folderError && <p className="mb-2 text-xs text-red-600">{folderError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingFolder || !newFolderName.trim()}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand-primary px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {savingFolder ? <Loader2 size={12} className="animate-spin" /> : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingFolder(false)
                      setNewFolderName('')
                      setFolderError(null)
                    }}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-text-sec"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingFolder(true)}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/5"
              >
                <FolderPlus size={14} />
                New folder
              </button>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-primary">{activeFolderName}</h2>
            <p className="text-xs text-text-soft">{filtered.length} image{filtered.length === 1 ? '' : 's'}</p>
          </div>

          {grouped.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
              <Images className="mx-auto mb-3 text-gray-300" size={40} />
              <p className="text-sm font-medium text-text-primary">
                {folderFilter === 'all' ? 'No saved assets yet' : 'No assets in this folder'}
              </p>
              <p className="mt-1 text-sm text-text-sec">
                {folderFilter === 'all'
                  ? (
                    <>
                      After you generate images in Agents, click <Bookmark size={14} className="inline" /> Save on any option.
                    </>
                  )
                  : 'Move images here from another folder, or save new generations from Agents.'}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {grouped.map(([day, dayAssets]) => (
                <section key={day}>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-menu-muted">{day}</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4">
                    {dayAssets.map(asset => (
                      <div
                        key={asset.id}
                        className="group relative overflow-hidden rounded-xl border border-gray-100 bg-white"
                      >
                        {asset.preview_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewAssetId(asset.id)}
                            className="block w-full cursor-zoom-in text-left"
                            aria-label="View larger preview"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={asset.preview_url}
                              alt={asset.brief_excerpt ?? 'Saved generation'}
                              className="aspect-[4/5] w-full object-cover transition-opacity hover:opacity-95"
                            />
                          </button>
                        ) : (
                          <div className="flex aspect-[4/5] items-center justify-center bg-gray-50 text-xs text-text-soft">
                            Preview unavailable
                          </div>
                        )}

                        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1">
                          <DownloadImageButton
                            storagePath={asset.storage_path}
                            mime={asset.mime}
                            filename={`asset-${asset.id.slice(0, 8)}.png`}
                            label="Download image"
                            iconOnly
                          />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => void toggleFavorite(asset)}
                              className="rounded-lg bg-white/95 p-1.5 shadow-sm"
                              aria-label={asset.is_favorite ? 'Remove favorite' : 'Favorite'}
                            >
                              <Heart
                                size={14}
                                className={asset.is_favorite ? 'fill-red-500 text-red-500' : 'text-gray-500'}
                              />
                            </button>
                            <button
                              type="button"
                              disabled={deletingAssetId === asset.id}
                              onClick={() => void deleteAsset(asset)}
                              className="rounded-lg bg-white/95 p-1.5 shadow-sm hover:bg-red-50"
                              aria-label="Delete asset"
                            >
                              {deletingAssetId === asset.id ? (
                                <Loader2 size={14} className="animate-spin text-gray-500" />
                              ) : (
                                <Trash2 size={14} className="text-gray-500 hover:text-red-600" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-gray-100 px-2.5 py-2">
                          <p className="text-[10px] font-semibold text-text-primary">
                            {asset.image_model_label ?? 'Generated'}
                          </p>
                          {asset.brief_excerpt && (
                            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-text-soft">
                              {asset.brief_excerpt}
                            </p>
                          )}

                          <label className="mt-2 block">
                            <span className="sr-only">Move to folder</span>
                            <select
                              value={asset.folder_id ?? ''}
                              disabled={movingAssetId === asset.id}
                              onChange={e => {
                                const value = e.target.value
                                void moveAsset(asset, value ? value : null)
                              }}
                              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[10px] font-medium text-text-sec outline-none focus:border-brand-primary"
                            >
                              <option value="">Uncategorized</option>
                              {folders.map(folder => (
                                <option key={folder.id} value={folder.id}>
                                  {folder.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <Link
                            href={`/dashboard/agents?useAsset=${asset.id}`}
                            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-2 py-1.5 text-[10px] font-semibold text-white no-underline hover:bg-[#2563EB]"
                          >
                            <Send size={12} />
                            Use for post
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {previewAsset && (
        <AssetPreviewModal
          asset={previewAsset}
          folders={folders}
          moving={movingAssetId === previewAsset.id}
          deleting={deletingAssetId === previewAsset.id}
          onClose={() => setPreviewAssetId(null)}
          onToggleFavorite={asset => void toggleFavorite(asset)}
          onDelete={asset => void deleteAsset(asset)}
          onMove={(asset, folderId) => void moveAsset(asset, folderId)}
        />
      )}
    </div>
  )
}
