'use client'

import Link from 'next/link'
import { Heart, Loader2, Send, Trash2, X } from 'lucide-react'
import DownloadImageButton from '@/components/media/DownloadImageButton'
import type { CreativeAssetFolderRow, CreativeAssetWithUrl } from '@/lib/creativeAssets'

type Props = {
  asset: CreativeAssetWithUrl
  folders: CreativeAssetFolderRow[]
  moving: boolean
  deleting: boolean
  onClose: () => void
  onToggleFavorite: (asset: CreativeAssetWithUrl) => void
  onDelete: (asset: CreativeAssetWithUrl) => void
  onMove: (asset: CreativeAssetWithUrl, folderId: string | null) => void
}

export default function AssetPreviewModal({
  asset,
  folders,
  moving,
  deleting,
  onClose,
  onToggleFavorite,
  onDelete,
  onMove,
}: Props) {
  const folderName =
    folders.find(f => f.id === asset.folder_id)?.name ?? 'Uncategorized'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Asset preview"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Close preview"
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-lg bg-white/95 p-2 shadow-sm hover:bg-white"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-gray-950 p-4 md:min-h-[420px] md:p-6">
          {asset.preview_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.preview_url}
              alt={asset.brief_excerpt ?? 'Saved generation'}
              className="max-h-[70vh] max-w-full object-contain"
            />
          ) : (
            <p className="text-sm text-white/70">Preview unavailable</p>
          )}
        </div>

        <div className="flex w-full flex-col border-t border-gray-100 md:w-80 md:border-l md:border-t-0">
          <div className="flex-1 overflow-y-auto p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
              Saved generation
            </p>
            <p className="mt-2 text-sm font-semibold text-text-primary">
              {asset.image_model_label ?? 'Generated'}
            </p>
            <p className="mt-1 text-xs text-text-soft">
              {new Date(asset.created_at).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
            <p className="mt-1 text-xs text-text-soft">Folder: {folderName}</p>

            {(asset.brief_excerpt || asset.brief) && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
                  Brief
                </p>
                <p className="mt-2 text-sm leading-relaxed text-text-sec">
                  {asset.brief ?? asset.brief_excerpt}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-gray-100 p-5">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
                Move to folder
              </span>
              <select
                value={asset.folder_id ?? ''}
                disabled={moving}
                onChange={e => onMove(asset, e.target.value ? e.target.value : null)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-text-sec outline-none focus:border-brand-primary"
              >
                <option value="">Uncategorized</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              <DownloadImageButton
                storagePath={asset.storage_path}
                mime={asset.mime}
                filename={`asset-${asset.id.slice(0, 8)}.png`}
                label="Download"
              />
              <button
                type="button"
                onClick={() => onToggleFavorite(asset)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-text-primary hover:border-gray-300"
              >
                <Heart
                  size={12}
                  className={asset.is_favorite ? 'fill-red-500 text-red-500' : 'text-gray-500'}
                />
                {asset.is_favorite ? 'Favorited' : 'Favorite'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => onDelete(asset)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Delete
              </button>
            </div>

            <Link
              href={`/dashboard/agents?useAsset=${asset.id}`}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white no-underline hover:bg-[#2563EB]"
            >
              <Send size={14} />
              Use for post
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
