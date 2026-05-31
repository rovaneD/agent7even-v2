'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Upload, Download, Folder, File, FileText, Image,
  Video, Archive, Loader2, AlertCircle, CheckCircle, X,
  ChevronDown, ChevronRight,
} from 'lucide-react'

interface Deliverable {
  id: string
  user_id: string
  uploaded_by: string
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
  if (!type) return <File size={18} className="text-gray-400" />
  if (type.startsWith('image/')) return <Image size={18} className="text-blue-400" />
  if (type.startsWith('video/')) return <Video size={18} className="text-purple-400" />
  if (type === 'application/pdf') return <FileText size={18} className="text-red-400" />
  if (type.includes('zip') || type.includes('archive')) return <Archive size={18} className="text-amber-400" />
  return <FileText size={18} className="text-gray-400" />
}

function roleBadge(role: string | null) {
  if (role === 'admin') return (
    <span className="text-xs font-medium text-[#c8522a] bg-[#c8522a]/10 px-2 py-0.5 rounded-full">
      From Agent7even
    </span>
  )
  return (
    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      Uploaded by you
    </span>
  )
}

export default function DeliverablesClient({ profileId: _profileId, companyName, deliverables: initial }: Props) {
  const [deliverables, setDeliverables] = useState<Deliverable[]>(initial)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  useEffect(() => {
    const grouped = initial.reduce<Record<string, number>>((acc, d) => {
      acc[d.project_name] = (acc[d.project_name] ?? 0) + 1
      return acc
    }, {})
    const projectLines = Object.keys(grouped).length
      ? Object.entries(grouped).map(([name, count]) => `- ${name}: ${count} file(s)`).join('\n')
      : '- No projects or files yet'
    const context = `DELIVERABLES PAGE
Company: ${companyName}
Total files: ${initial.length}
Projects:
${projectLines}
The user can download files from Agent7even and upload their own briefs and assets.`
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context } }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
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
        body: JSON.stringify({ filePath: deliverable.file_path }),
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

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Deliverables</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {companyName ? `${companyName} — ` : ''}Files, assets, and project briefs
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 bg-[#c8522a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#b8471f] transition-colors"
        >
          <Upload size={15} />
          Upload file
        </button>
      </div>

      {/* Success / error banners */}
      {uploadSuccess && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <CheckCircle size={15} className="text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-700">{uploadSuccess}</p>
          <button onClick={() => setUploadSuccess(null)} className="ml-auto">
            <X size={14} className="text-emerald-400" />
          </button>
        </div>
      )}
      {uploadError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{uploadError}</p>
          <button onClick={() => setUploadError(null)} className="ml-auto">
            <X size={14} className="text-red-400" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Folder size={24} className="text-gray-300" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">No files yet</h3>
          <p className="text-xs text-gray-400 max-w-xs mx-auto mb-6 leading-relaxed">
            Your Agent7even team will upload deliverables here as projects are completed.
            You can also upload briefs and assets for your team.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#c8522a] bg-[#c8522a]/10 hover:bg-[#c8522a]/15 px-4 py-2.5 rounded-xl transition-colors"
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
          <div key={project} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button
              onClick={() => toggleProject(project)}
              className="w-full flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <Folder size={17} className="text-[#c8522a] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{project}</p>
                <p className="text-xs text-gray-400">{files.length} file{files.length !== 1 ? 's' : ''}</p>
              </div>
              {isExpanded
                ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              }
            </button>

            {isExpanded && (
              <div className="border-t border-gray-50 divide-y divide-gray-50">
                {files.map(file => (
                  <div key={file.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <FileIcon type={file.file_type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400">{formatBytes(file.file_size)}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{formatDate(file.created_at)}</span>
                        <span className="text-xs text-gray-300">·</span>
                        {roleBadge(file.uploaded_by_role)}
                      </div>
                      {file.notes && (
                        <p className="text-xs text-gray-400 mt-1 italic">{file.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDownload(file)}
                      disabled={downloading === file.id}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
                    >
                      {downloading === file.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Download size={13} />
                      }
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Upload modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Upload file</h3>
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
                    selectedFile ? 'border-[#c8522a]/40 bg-[#c8522a]/5' : 'border-gray-200 hover:border-gray-300'
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
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#c8522a] focus:ring-1 focus:ring-[#c8522a]/20 placeholder:text-gray-300"
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
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#c8522a] focus:ring-1 focus:ring-[#c8522a]/20 placeholder:text-gray-300 resize-none"
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
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#c8522a] hover:bg-[#b8471f] py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
