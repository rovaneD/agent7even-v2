'use client'

import { useState, useRef } from 'react'
import {
  Upload, Download, Folder, File, FileText, Image,
  Video, Archive, Trash2, Loader2, X, AlertCircle, CheckCircle,
} from 'lucide-react'

interface Deliverable {
  id: string
  project_id: string
  project_name: string
  file_name: string
  file_path: string
  file_size: number | null
  file_type: string | null
  notes: string | null
  uploaded_by: string | null
  uploaded_by_role: string | null
  created_at: string
}

interface Props {
  clientId: string
  initialDeliverables: Deliverable[]
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
  if (!type) return <File size={15} className="text-gray-400" />
  if (type.startsWith('image/')) return <Image size={15} className="text-blue-400" />
  if (type.startsWith('video/')) return <Video size={15} className="text-purple-400" />
  if (type === 'application/pdf') return <FileText size={15} className="text-red-400" />
  if (type.includes('zip') || type.includes('archive')) return <Archive size={15} className="text-amber-400" />
  return <FileText size={15} className="text-gray-400" />
}

export default function AdminDeliverables({ clientId, initialDeliverables }: Props) {
  const [deliverables, setDeliverables] = useState<Deliverable[]>(initialDeliverables)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!selectedFile || !projectName.trim()) return
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('projectName', projectName.trim())
      formData.append('notes', notes.trim())
      formData.append('role', 'admin')
      formData.append('clientId', clientId)

      const res = await fetch('/api/deliverables/admin-upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Upload failed')
      }

      const { deliverable } = await res.json()
      setDeliverables(prev => [deliverable, ...prev])
      setSuccess(`${selectedFile.name} uploaded successfully`)
      setSelectedFile(null)
      setProjectName('')
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(d: Deliverable) {
    setDownloading(d.id)
    try {
      const res = await fetch('/api/deliverables/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliverableId: d.id }),
      })
      const { url } = await res.json()
      if (url) {
        const a = document.createElement('a')
        a.href = url
        a.download = d.file_name
        a.click()
      }
    } finally {
      setDownloading(null)
    }
  }

  async function handleDelete(d: Deliverable) {
    if (!confirm(`Delete "${d.file_name}"? This cannot be undone.`)) return
    setDeleting(d.id)
    try {
      await fetch('/api/deliverables/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliverableId: d.id }),
      })
      setDeliverables(prev => prev.filter(f => f.id !== d.id))
    } finally {
      setDeleting(null)
    }
  }

  const grouped = deliverables.reduce<Record<string, Deliverable[]>>((acc, d) => {
    if (!acc[d.project_name]) acc[d.project_name] = []
    acc[d.project_name].push(d)
    return acc
  }, {})

  return (
    <div className="space-y-5">

      {/* Upload form */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Upload deliverable for client</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Project / folder</label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. Brand Kit, Social Media"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#3B82F6] bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Version 1, Final, etc."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#3B82F6] bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors ${
              selectedFile ? 'border-[#3B82F6]/40 bg-[#2D3748]/5' : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <Upload size={15} className="text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-500 truncate">
              {selectedFile ? selectedFile.name : 'Select file (max 50MB)'}
            </span>
            {selectedFile && (
              <span className="text-xs text-gray-400 flex-shrink-0">{formatBytes(selectedFile.size)}</span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={handleUpload}
            disabled={!selectedFile || !projectName.trim() || uploading}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-[#2D3748] hover:bg-[#1E293B] px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertCircle size={13} className="text-red-500" />
            <p className="text-xs text-red-700">{error}</p>
            <button onClick={() => setError(null)} aria-label="Dismiss error" className="ml-auto"><X size={12} className="text-red-400" /></button>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            <CheckCircle size={13} className="text-emerald-600" />
            <p className="text-xs text-emerald-700">{success}</p>
            <button onClick={() => setSuccess(null)} aria-label="Dismiss message" className="ml-auto"><X size={12} className="text-emerald-400" /></button>
          </div>
        )}
      </div>

      {/* File list */}
      {deliverables.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No files uploaded yet</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([project, files]) => (
            <div key={project} className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <Folder size={14} className="text-[#64748B]" />
                <span className="text-xs font-semibold text-gray-700">{project}</span>
                <span className="text-xs text-gray-400 ml-auto">{files.length} file{files.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {files.map(file => (
                  <div key={file.id} className="flex items-center gap-3 px-4 py-3">
                    <FileIcon type={file.file_type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{file.file_name}</p>
                      <p className="text-xs text-gray-400">{formatBytes(file.file_size)} · {formatDate(file.created_at)}</p>
                      {file.notes && <p className="text-xs text-gray-400 italic">{file.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleDownload(file)}
                        disabled={downloading === file.id}
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        {downloading === file.id
                          ? <Loader2 size={15} className="animate-spin" />
                          : <Download size={15} />
                        }
                      </button>
                      <button
                        onClick={() => handleDelete(file)}
                        disabled={deleting === file.id}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        {deleting === file.id
                          ? <Loader2 size={15} className="animate-spin" />
                          : <Trash2 size={15} />
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
