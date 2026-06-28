'use client'

import { useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useMayaContext } from '@/hooks/useMayaContext'
import { buildDeliverablesMayaContext } from '@/lib/maya/summaries/workspaceContext'
import {
  Upload, Download, Folder, File, FileText, Image,
  Video, Archive, Loader2, AlertCircle, CheckCircle, X,
  ChevronDown, ChevronRight, Trash2, Info,
} from 'lucide-react'

interface Deliverable {
  id: string
  project_id: string
  uploaded_by: string | null
  project_name: string
  file_name: string
  file_path: string
  file_size: number | null
  file_type: string | null
  notes: string | null
  uploaded_by_role: string | null
  created_at: string
}

interface Props {
  profileId: string
  companyName: string
  deliverables: Deliverable[]
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function FileIcon({ type }: { type: string | null }) {
  if (!type) return <File size={18} className="text-text-soft" />
  if (type.startsWith('image/')) return <Image size={18} className="text-brand-primary" />
  if (type.startsWith('video/')) return <Video size={18} className="text-brand-accent" />
  if (type === 'application/pdf') return <FileText size={18} className="text-status-danger" />
  if (type.includes('zip') || type.includes('archive')) return <Archive size={18} className="text-status-warning" />
  return <FileText size={18} className="text-text-soft" />
}

function roleBadge(role: string | null) {
  if (role === 'admin') return (
    <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-medium text-brand-primary">
      From Agent7even
    </span>
  )
  return (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-sec">
      Uploaded by you
    </span>
  )
}

export default function DeliverablesClient({ profileId: _profileId, companyName, deliverables: initial }: Props) {
  const [deliverables, setDeliverables] = useState<Deliverable[]>(initial)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  const mayaContext = useMemo(
    () => buildDeliverablesMayaContext({ companyName, deliverables }),
    [companyName, deliverables],
  )
  useMayaContext(mayaContext)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const grouped = deliverables.reduce<Record<string, Deliverable[]>>((acc, d) => {
    if (!acc[d.project_name]) acc[d.project_name] = []
    acc[d.project_name].push(d)
    return acc
  }, {})

  const projects = Object.keys(grouped).sort()

  function toggleProject(name: string) {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  async function handleUpload() {
    if (!selectedFile || !projectName.trim()) return
    setUploading(true)
    setUploadError(null)
    setUploadSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('projectName', projectName.trim())
      formData.append('notes', notes.trim())
      formData.append('role', 'client')

      const res = await fetch('/api/deliverables/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Upload failed')
      }

      const { deliverable } = await res.json()
      setDeliverables(prev => [deliverable, ...prev])
      setExpandedProjects(prev => new Set([...prev, projectName.trim()]))
      setUploadSuccess(`${selectedFile.name} uploaded successfully`)
      setShowUploadModal(false)
      setSelectedFile(null)
      setProjectName('')
      setNotes('')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(deliverable: Deliverable) {
    setDownloading(deliverable.id)
    try {
      const res = await fetch('/api/deliverables/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliverableId: deliverable.id }),
      })
      const { url } = await res.json()
      if (url) {
        const a = document.createElement('a')
        a.href = url
        a.download = deliverable.file_name
        a.click()
      }
    } catch {
      setUploadError('Download failed. Please try again.')
    } finally {
      setDownloading(null)
    }
  }

  async function handleDelete(deliverable: Deliverable) {
    if (!confirm(`Delete "${deliverable.file_name}"? This cannot be undone.`)) return
    setDeleting(deliverable.id)
    setUploadError(null)
    try {
      const res = await fetch('/api/deliverables/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliverableId: deliverable.id }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Delete failed')
      }

      setDeliverables(prev => prev.filter(file => file.id !== deliverable.id))
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Delete failed. Please try again.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-8 space-y-6">

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">Deliverables</p>
            <h1 className="text-[30px] font-semibold tracking-tight text-text">Files and assets</h1>
            <p className="mt-2 text-sm leading-6 text-text-sec">
              {companyName ? `${companyName} — ` : ''}Project deliverables from your team and files you upload for reference.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-soft">Files</p>
              <p className="mt-1 text-2xl font-semibold text-text">{deliverables.length}</p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2563EB]"
            >
              <Upload size={15} />
              Upload file
            </button>
          </div>
        </div>
      </section>

      <div className="flex gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
        <Info size={18} className="mt-0.5 flex-shrink-0 text-brand-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text">How uploads connect to agents</p>
          <p className="mt-1 text-xs leading-relaxed text-text-sec">
            Files here appear in Maya&apos;s workspace context — mention a project or filename in chat.
            For AI-generated content, pair uploads with Foundation and Brand Kit so agents know your voice and visuals.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/dashboard/foundation" className="text-xs font-semibold text-brand-primary hover:text-[#2563EB]">
              Foundation →
            </Link>
            <Link href="/dashboard/brand-kit" className="text-xs font-semibold text-brand-primary hover:text-[#2563EB]">
              Brand Kit →
            </Link>
            <Link href="/dashboard/agents" className="text-xs font-semibold text-brand-primary hover:text-[#2563EB]">
              Agents →
            </Link>
          </div>
        </div>
      </div>

      {/* Success / error banners */}
      {uploadSuccess && (
        <div className="flex items-start gap-3 rounded-xl border border-status-success/20 bg-status-success/10 px-4 py-3">
          <CheckCircle size={15} className="mt-0.5 flex-shrink-0 text-status-success" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-status-success">{uploadSuccess}</p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-700/90">
              Maya can reference this file in chat. Add brand context in Foundation or Brand Kit for richer agent output.
            </p>
          </div>
          <button onClick={() => setUploadSuccess(null)} className="ml-auto flex-shrink-0">
            <X size={14} className="text-emerald-400" />
          </button>
        </div>
      )}
      {uploadError && (
        <div className="flex items-center gap-3 rounded-xl border border-status-danger/20 bg-status-danger/10 px-4 py-3">
          <AlertCircle size={15} className="flex-shrink-0 text-status-danger" />
          <p className="text-sm text-status-danger">{uploadError}</p>
          <button onClick={() => setUploadError(null)} className="ml-auto">
            <X size={14} className="text-red-400" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10">
            <Folder size={24} className="text-brand-primary" />
          </div>
          <h3 className="mb-1 text-sm font-semibold text-text">No files yet</h3>
          <p className="mx-auto mb-6 max-w-xs text-xs leading-relaxed text-text-sec">
            Your Agent7even team will upload deliverables here as projects are completed.
            You can also upload briefs and assets for your team.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-primary/10 px-4 py-2.5 text-sm font-semibold text-brand-primary transition-colors hover:bg-brand-primary/15"
          >
            <Upload size={14} />
            Upload your first file
          </button>
        </div>
      )}

      {/* Projects */}
      {projects.map(project => {
        const files = grouped[project]
        const isExpanded = expandedProjects.has(project)
        return (
          <div key={project} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <button
              onClick={() => toggleProject(project)}
              className="flex w-full items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-surface-2"
            >
              <Folder size={17} className="flex-shrink-0 text-brand-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text">{project}</p>
                <p className="text-xs text-text-soft">{files.length} file{files.length !== 1 ? 's' : ''}</p>
              </div>
              {isExpanded
                ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              }
            </button>

            {isExpanded && (
              <div className="divide-y divide-border border-t border-border">
                {files.map(file => (
                  <div key={file.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-2">
                      <FileIcon type={file.file_type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-text">{file.file_name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-text-soft">{formatBytes(file.file_size)}</span>
                        <span className="text-xs text-text-soft">·</span>
                        <span className="text-xs text-text-soft">{formatDate(file.created_at)}</span>
                        <span className="text-xs text-text-soft">·</span>
                        {roleBadge(file.uploaded_by_role)}
                      </div>
                      {file.notes && (
                        <p className="mt-1 text-xs italic text-text-soft">{file.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleDownload(file)}
                        disabled={downloading === file.id}
                        className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs font-medium text-text-sec transition-colors hover:text-text disabled:opacity-50"
                      >
                        {downloading === file.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Download size={13} />
                        }
                        Download
                      </button>
                      <button
                        onClick={() => handleDelete(file)}
                        disabled={deleting === file.id}
                        className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs font-medium text-text-soft transition-colors hover:bg-status-danger/10 hover:text-status-danger disabled:opacity-50"
                      >
                        {deleting === file.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} />
                        }
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Upload modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[24px] border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <h3 className="text-[17px] font-semibold text-text">Upload file</h3>
              <button onClick={() => setShowUploadModal(false)}>
                <X size={18} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* File picker */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                  File
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                    selectedFile ? 'border-brand-primary/40 bg-brand-primary/5' : 'border-border hover:border-border-strong'
                  }`}
                >
                  {selectedFile ? (
                    <div>
                      <div className="flex justify-center mb-2">
                        <FileIcon type={selectedFile.type} />
                      </div>
                      <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
                      <p className="text-xs text-gray-400">{formatBytes(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <Upload size={20} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Click to select a file</p>
                      <p className="text-xs text-gray-400 mt-1">Max 50MB — any file type</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {/* Project name */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                  Project / folder name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="e.g. Brand Kit, Social Media Assets, Website Brief"
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm placeholder:text-text-soft focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/20"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">
                  Notes <span className="text-gray-400 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add any context about this file..."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border px-4 py-3 text-sm placeholder:text-text-soft focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/20"
                />
              </div>

              {uploadError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-700">{uploadError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || !projectName.trim() || uploading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? (
                    <><Loader2 size={14} className="animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload size={14} /> Upload</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
