'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Shapes, Palette, Type, Image as ImageIcon, MessageSquare, Layout,
  Plus, Trash2, Upload, ExternalLink, Sparkles, Loader2, Check,
  X, Save,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface SectionCompletion { section_key: string; completed: boolean }
interface BrandColor { id: string; role: string; name: string | null; hex: string; rgb: string | null; notes: string | null; sort_order: number }
interface BrandFont  { id: string; role: string; family: string; weight: string | null; size_guide: string | null; source_url: string | null; notes: string | null }
interface GeneratedColor { name: string; hex: string; rgb: string; role: string }
interface GeneratedFontDef { family: string; weight: string; size_guide: string }
interface GeneratedPairing { name: string; rationale: string; heading: GeneratedFontDef; body: GeneratedFontDef }
interface BrandAsset { id: string; section_key: string; asset_type: string; name: string; file_url: string | null; external_url: string | null; thumbnail_url: string | null; signed_url?: string; metadata: Record<string, unknown> | null; sort_order: number }
interface FoundationDoc { id: string; type: string; title: string | null; markdown: string | null; version: number | null }

interface Props {
  profileId: string
  companyName: string
  initialSections: SectionCompletion[]
  initialColors: BrandColor[]
  initialFonts: BrandFont[]
  initialAssets: BrandAsset[]
  initialDocuments: FoundationDoc[]
}

type SectionKey = 'identity' | 'colors' | 'typography' | 'imagery' | 'voice' | 'templates'

// ── Constants ──────────────────────────────────────────────────────────────

const SECTIONS: { key: SectionKey; label: string; Icon: React.ElementType }[] = [
  { key: 'identity',   label: 'Identity',    Icon: Shapes       },
  { key: 'colors',     label: 'Colors',      Icon: Palette      },
  { key: 'typography', label: 'Typography',  Icon: Type         },
  { key: 'imagery',    label: 'Imagery',     Icon: ImageIcon    },
  { key: 'voice',      label: 'Voice',       Icon: MessageSquare },
  { key: 'templates',  label: 'Templates',   Icon: Layout       },
]

const COLOR_ROLES  = ['primary', 'secondary', 'accent', 'neutral']
const FONT_ROLES: { role: string; label: string; desc: string }[] = [
  { role: 'heading',    label: 'Heading Font',    desc: 'H1, H2, H3 — large display text' },
  { role: 'subheading', label: 'Subheading Font', desc: 'H4, H5 — section headers' },
  { role: 'body',       label: 'Body Font',       desc: 'Paragraphs and general text' },
  { role: 'accent',     label: 'Accent Font',     desc: 'Callouts, quotes, special use' },
]

const LOGO_SLOTS = [
  { type: 'logo_primary',   label: 'Primary Logo',   desc: 'Main logo used in most contexts' },
  { type: 'logo_alternate', label: 'Alternate Logo',  desc: 'Stacked or horizontal variant' },
  { type: 'logo_icon',      label: 'Icon / Mark',     desc: 'Symbol or monogram only' },
]

const FOUNDATION_DOC_TYPES = ['voice', 'brief', 'icp', 'positioning']
const FOUNDATION_DOC_LABELS: Record<string, string> = {
  voice:       'Brand Voice Guide',
  brief:       'Business Brief',
  icp:         'Ideal Customer Profile',
  positioning: 'Positioning Statement',
}
const ADDITIONAL_DOC_TYPES: { type: string; title: string; placeholder: string }[] = [
  { type: 'tagline',        title: 'Tagline',           placeholder: 'Your one-line brand statement' },
  { type: 'elevator_pitch', title: 'Elevator Pitch',    placeholder: '30-second verbal description of what you do and for who' },
  { type: 'about_us',       title: 'About Us',          placeholder: 'Standard About Us block for website, bio, and directories' },
  { type: 'mission',        title: 'Mission Statement', placeholder: 'Why your company exists' },
]

const TEMPLATE_TYPES = [
  { type: 'template_canva',  label: 'Canva',         placeholder: 'https://canva.com/...' },
  { type: 'template_slides', label: 'Google Slides', placeholder: 'https://docs.google.com/presentation/...' },
  { type: 'template_figma',  label: 'Figma',         placeholder: 'https://figma.com/...' },
  { type: 'other',           label: 'Other link',    placeholder: 'https://...' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return ''
  return `${r}, ${g}, ${b}`
}

// ── Main component ─────────────────────────────────────────────────────────

export default function BrandKitView({
  profileId,
  companyName,
  initialSections,
  initialColors,
  initialFonts,
  initialAssets,
  initialDocuments,
}: Props) {
  const [activeSection, setActiveSection] = useState<SectionKey>('identity')
  const [sections,  setSections]  = useState<SectionCompletion[]>(initialSections)
  const [colors,    setColors]    = useState<BrandColor[]>(initialColors)
  const [fonts,     setFonts]     = useState<BrandFont[]>(initialFonts)
  const [assets,    setAssets]    = useState<BrandAsset[]>(initialAssets)
  const [documents, setDocuments] = useState<FoundationDoc[]>(initialDocuments)

  const completedCount = SECTIONS.filter(s =>
    sections.find(r => r.section_key === s.key)?.completed
  ).length

  // Maya canvas context + nav progress
  useEffect(() => {
    const colorCtx  = colors.length > 0 ? `Colors: ${colors.map(c => `${c.name ?? ''} ${c.hex} (${c.role})`).join(', ')}` : 'Colors: not set'
    const fontCtx   = fonts.length  > 0 ? `Fonts: ${fonts.map(f => `${f.family} (${f.role})`).join(', ')}` : 'Typography: not set'
    const assetCtx  = assets.length > 0 ? `Assets: ${assets.length} files uploaded` : 'Assets: none uploaded'
    const docCtx    = documents.length > 0 ? `Documents: ${documents.map(d => d.type).join(', ')}` : 'Voice documents: not yet generated'
    const ctx = [`Brand Kit — ${completedCount}/6 sections complete`, colorCtx, fontCtx, assetCtx, docCtx].join('\n')
    window.dispatchEvent(new CustomEvent('maya:canvas-context', { detail: { context: ctx } }))
    window.dispatchEvent(new CustomEvent('brandkit:progress', { detail: { completed: completedCount } }))
  }, [colors, fonts, assets, documents, completedCount])

  async function markSection(key: SectionKey, completed: boolean) {
    setSections(prev => {
      const existing = prev.find(s => s.section_key === key)
      if (existing) return prev.map(s => s.section_key === key ? { ...s, completed } : s)
      return [...prev, { section_key: key, completed }]
    })
    await fetch('/api/brand-kit/sections/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionKey: key, completed }),
    })
  }

  function isCompleted(key: SectionKey) {
    return sections.find(s => s.section_key === key)?.completed ?? false
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-semibold tracking-widest uppercase text-[#9BA1AE] mb-2">Brand Kit</p>
          <h1 className="text-2xl font-bold text-gray-900">Brand Identity</h1>
          <p className="text-sm text-gray-400 mt-1">Your complete brand system — colors, fonts, voice, and assets</p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <div className="text-right">
            <p className="text-xs text-gray-400">Complete</p>
            <p className="text-lg font-semibold text-gray-900">{completedCount}/6</p>
          </div>
          <div className="w-24 bg-[#E2E8F0] rounded-full h-2">
            <div className={`${completedCount === 6 ? 'bg-[#10B981]' : 'bg-[#3B82F6]'} rounded-full h-2 transition-all`} style={{ width: `${(completedCount / 6) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1.5 mb-8 flex-wrap">
        {SECTIONS.map(({ key, label, Icon }) => {
          const done   = isCompleted(key)
          const active = activeSection === key
          return (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                active ? 'bg-[#2D3748] text-white' : 'text-[#9BA1AE] hover:text-[#2D3748] hover:bg-[#F8F8F8] bg-white border border-[#E2E8F0]'
              }`}
            >
              <Icon size={13} strokeWidth={1.75} />
              {label}
              {done && <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-0.5" />}
            </button>
          )
        })}
      </div>

      {/* Active section */}
      {activeSection === 'identity'   && <IdentitySection   profileId={profileId} assets={assets.filter(a => a.section_key === 'identity')} onAssetsChange={setAssets} allAssets={assets} onMarkComplete={c => markSection('identity', c)}   completed={isCompleted('identity')} />}
      {activeSection === 'colors'     && <ColorsSection     profileId={profileId} colors={colors} onColorsChange={setColors} onMarkComplete={c => markSection('colors', c)}       completed={isCompleted('colors')} />}
      {activeSection === 'typography' && <TypographySection profileId={profileId} fonts={fonts}   onFontsChange={setFonts}   onMarkComplete={c => markSection('typography', c)} completed={isCompleted('typography')} />}
      {activeSection === 'imagery'    && <ImagerySection    profileId={profileId} assets={assets.filter(a => a.section_key === 'imagery')}  documents={documents} onAssetsChange={setAssets} allAssets={assets} onDocumentsChange={setDocuments} onMarkComplete={c => markSection('imagery', c)}    completed={isCompleted('imagery')} />}
      {activeSection === 'voice'      && <VoiceSection      profileId={profileId} documents={documents} onDocumentsChange={setDocuments} onMarkComplete={c => markSection('voice', c)}      completed={isCompleted('voice')} />}
      {activeSection === 'templates'  && <TemplatesSection  profileId={profileId} assets={assets.filter(a => a.section_key === 'templates')} onAssetsChange={setAssets} allAssets={assets} onMarkComplete={c => markSection('templates', c)}  completed={isCompleted('templates')} />}
    </div>
  )
}

// ── Section 1: Identity ────────────────────────────────────────────────────

function IdentitySection({ profileId, assets, onAssetsChange, allAssets, onMarkComplete, completed }: {
  profileId: string
  assets: BrandAsset[]
  onAssetsChange: (assets: BrandAsset[]) => void
  allAssets: BrandAsset[]
  onMarkComplete: (v: boolean) => void
  completed: boolean
}) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [externalUrls, setExternalUrls] = useState<Record<string, string>>({})
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    const hasLogo = assets.some(a => ['logo_primary','logo_alternate','logo_icon'].includes(a.asset_type))
    if (hasLogo !== completed) onMarkComplete(hasLogo)
  }, [assets]) // eslint-disable-line react-hooks/exhaustive-deps

  async function uploadLogo(type: string, file: File) {
    setUploading(prev => ({ ...prev, [type]: true }))
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('name', file.name)
      form.append('sectionKey', 'identity')
      form.append('assetType', type)
      const res  = await fetch('/api/brand-kit/assets', { method: 'POST', body: form })
      const data = await res.json()
      if (data.asset) {
        onAssetsChange([...allAssets, data.asset])
      }
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }))
    }
  }

  async function linkLogo(type: string, url: string) {
    if (!url.trim()) return
    const res  = await fetch('/api/brand-kit/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: type.replace(/_/g, ' '), section_key: 'identity', asset_type: type, external_url: url }),
    })
    const data = await res.json()
    if (data.asset) onAssetsChange([...allAssets, data.asset])
    setExternalUrls(prev => ({ ...prev, [type]: '' }))
  }

  async function deleteAsset(id: string) {
    await fetch(`/api/brand-kit/assets/${id}`, { method: 'DELETE' })
    onAssetsChange(allAssets.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-5">Logo files</h2>
        <div className="space-y-4">
          {LOGO_SLOTS.map(slot => {
            const existing = assets.filter(a => a.asset_type === slot.type)
            const isLoading = uploading[slot.type]
            return (
              <div key={slot.type}>
                <p className="text-sm font-medium text-gray-800 mb-1">{slot.label}</p>
                <p className="text-xs text-gray-400 mb-3">{slot.desc}</p>

                {/* Existing uploads */}
                {existing.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-3">
                    {existing.map(asset => (
                      <div key={asset.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                        {(asset.signed_url || asset.file_url || asset.external_url) && (
                          <img
                            src={asset.signed_url ?? asset.external_url ?? asset.file_url ?? ''}
                            alt={asset.name}
                            className="h-8 w-8 object-contain rounded"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        )}
                        <span className="text-xs text-gray-600 max-w-[120px] truncate">{asset.name}</span>
                        {asset.external_url && (
                          <a href={asset.external_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700">
                            <ExternalLink size={12} />
                          </a>
                        )}
                        <button onClick={() => deleteAsset(asset.id)} className="text-gray-300 hover:text-red-400 ml-1">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  {/* Upload button */}
                  <button
                    onClick={() => fileRefs.current[slot.type]?.click()}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl px-3 py-2 hover:border-gray-400 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Upload file
                  </button>
                  <input
                    ref={el => { fileRefs.current[slot.type] = el }}
                    type="file"
                    accept="image/*,.svg"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(slot.type, f); e.target.value = '' }}
                  />
                  {/* External URL */}
                  <input
                    type="url"
                    value={externalUrls[slot.type] ?? ''}
                    onChange={e => setExternalUrls(prev => ({ ...prev, [slot.type]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') linkLogo(slot.type, externalUrls[slot.type] ?? '') }}
                    placeholder="or paste URL"
                    className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#3B82F6]"
                  />
                  <button
                    onClick={() => linkLogo(slot.type, externalUrls[slot.type] ?? '')}
                    className="text-xs font-medium text-gray-600 border border-gray-200 rounded-xl px-3 py-2 hover:border-gray-400 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Section 2: Colors ──────────────────────────────────────────────────────

function ColorsSection({ profileId: _profileId, colors, onColorsChange, onMarkComplete, completed }: {
  profileId: string
  colors: BrandColor[]
  onColorsChange: (c: BrandColor[]) => void
  onMarkComplete: (v: boolean) => void
  completed: boolean
}) {
  const [savingId,    setSavingId]    = useState<string | null>(null)
  const [localColors, setLocalColors] = useState<BrandColor[]>(colors)
  const [generating,  setGenerating]  = useState(false)
  const [preview,     setPreview]     = useState<GeneratedColor[] | null>(null)
  const [accepting,   setAccepting]   = useState(false)
  const [genError,    setGenError]    = useState<string | null>(null)

  useEffect(() => { setLocalColors(colors) }, [colors])

  useEffect(() => {
    const hasPrimary = localColors.some(c => c.role === 'primary')
    if (hasPrimary !== completed) onMarkComplete(hasPrimary)
  }, [localColors]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateLocal(id: string, field: keyof BrandColor, value: string) {
    setLocalColors(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  async function saveColor(color: BrandColor) {
    setSavingId(color.id)
    try {
      const res  = await fetch('/api/brand-kit/colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: color.id.startsWith('new_') ? undefined : color.id, role: color.role, name: color.name, hex: color.hex, rgb: color.rgb, notes: color.notes, sort_order: color.sort_order }),
      })
      const data = await res.json()
      if (data.color) {
        const updated = localColors.map(c => c.id === color.id ? data.color : c)
        setLocalColors(updated)
        onColorsChange(updated)
      }
    } finally {
      setSavingId(null)
    }
  }

  async function deleteColor(id: string) {
    if (!id.startsWith('new_')) {
      await fetch(`/api/brand-kit/colors/${id}`, { method: 'DELETE' })
    }
    const updated = localColors.filter(c => c.id !== id)
    setLocalColors(updated)
    onColorsChange(updated)
  }

  function addColor() {
    const newColor: BrandColor = {
      id: `new_${Date.now()}`,
      role: 'primary',
      name: '',
      hex: '#000000',
      rgb: '0, 0, 0',
      notes: null,
      sort_order: localColors.length,
    }
    setLocalColors(prev => [...prev, newColor])
  }

  async function generatePalette() {
    setGenerating(true)
    setGenError(null)
    setPreview(null)
    try {
      const res  = await fetch('/api/brand-kit/generate-colors', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setGenError(data.error === 'INSUFFICIENT_CREDITS' ? 'Not enough credits (2 required).' : (data.error ?? 'Generation failed'))
        return
      }
      setPreview(data.colors)
    } finally {
      setGenerating(false)
    }
  }

  async function acceptPalette() {
    if (!preview) return
    setAccepting(true)
    try {
      const saved: BrandColor[] = []
      for (let i = 0; i < preview.length; i++) {
        const c = preview[i]
        const res  = await fetch('/api/brand-kit/colors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: c.role, name: c.name, hex: c.hex, rgb: c.rgb, notes: null, sort_order: localColors.length + i }),
        })
        const data = await res.json()
        if (data.color) saved.push(data.color)
      }
      const updated = [...localColors, ...saved]
      setLocalColors(updated)
      onColorsChange(updated)
      setPreview(null)
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-gray-700">Color palette</h2>
        <button onClick={addColor} className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-[#2D3748]">
          <Plus size={14} /> Add color
        </button>
      </div>

      {/* Empty state with generate option */}
      {localColors.length === 0 && !preview && (
        <div className="border border-dashed border-gray-200 rounded-2xl p-8 text-center mb-5">
          <Palette size={24} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No colors yet.</p>
          <p className="text-xs text-gray-400 mb-5">Generate a palette based on your brand or add colors manually.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={generatePalette}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2D3748] text-white text-sm font-medium rounded-xl hover:bg-[#1a2535] disabled:opacity-60 transition-colors"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {generating ? 'Generating…' : 'Generate with Maya'}
            </button>
            <button
              onClick={addColor}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:border-gray-400 transition-colors"
            >
              Add manually
            </button>
          </div>
          {genError && <p className="text-xs text-red-500 mt-3">{genError}</p>}
        </div>
      )}

      {/* Palette preview */}
      {preview && (
        <div className="mb-5 rounded-2xl border border-[#3B82F6]/20 bg-[#2D3748]/4 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Suggested palette</p>
            <span className="text-xs text-gray-400">2 credits used</span>
          </div>

          <div className="flex gap-2 mb-4">
            {preview.map((c, i) => (
              <div key={i} className="flex-1 text-center">
                <div
                  className="h-14 rounded-xl mb-1.5 border border-white shadow-sm"
                  style={{ backgroundColor: c.hex }}
                />
                <p className="text-xs font-medium text-gray-700 truncate">{c.name}</p>
                <p className="text-[10px] font-mono text-gray-400">{c.hex}</p>
                <p className="text-[10px] text-gray-400 capitalize">{c.role}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={acceptPalette}
              disabled={accepting}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2D3748] text-white text-sm font-medium rounded-xl hover:bg-[#1a2535] disabled:opacity-60 transition-colors"
            >
              {accepting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {accepting ? 'Saving…' : 'Accept palette'}
            </button>
            <button
              onClick={generatePalette}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:border-gray-400 disabled:opacity-50 transition-colors"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {generating ? 'Generating…' : 'Try again'}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="px-4 py-2 border border-gray-200 text-gray-400 text-sm rounded-xl hover:border-gray-400 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Generate button when colors exist */}
      {localColors.length > 0 && !preview && (
        <div className="flex justify-end mb-4">
          <button
            onClick={generatePalette}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#2D3748] border border-gray-200 rounded-xl px-3 py-1.5 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {generating ? 'Generating…' : 'Regenerate palette'}
          </button>
        </div>
      )}
      {localColors.length > 0 && genError && <p className="text-xs text-red-500 mb-3">{genError}</p>}

      <div className="space-y-1">
        {localColors.map(color => (
          <div key={color.id} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
            <div className="relative flex-shrink-0">
              <div
                className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer overflow-hidden"
                style={{ backgroundColor: color.hex }}
              >
                <input
                  type="color"
                  value={color.hex}
                  onChange={e => {
                    const hex = e.target.value
                    updateLocal(color.id, 'hex', hex)
                    updateLocal(color.id, 'rgb', hexToRgb(hex))
                  }}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </div>
            </div>

            <div className="flex-1 grid grid-cols-4 gap-2">
              <input
                value={color.name ?? ''}
                onChange={e => updateLocal(color.id, 'name', e.target.value)}
                onBlur={() => saveColor(color)}
                placeholder="Name"
                className="text-sm border border-gray-100 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#3B82F6] bg-gray-50"
              />
              <input
                value={color.hex}
                onChange={e => { updateLocal(color.id, 'hex', e.target.value); updateLocal(color.id, 'rgb', hexToRgb(e.target.value)) }}
                onBlur={() => saveColor(color)}
                placeholder="#000000"
                className="text-sm font-mono border border-gray-100 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#3B82F6] bg-gray-50"
              />
              <input
                value={color.rgb ?? ''}
                onChange={e => updateLocal(color.id, 'rgb', e.target.value)}
                onBlur={() => saveColor(color)}
                placeholder="0, 0, 0"
                className="text-sm font-mono border border-gray-100 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#3B82F6] bg-gray-50"
              />
              <select
                value={color.role}
                onChange={e => { updateLocal(color.id, 'role', e.target.value) }}
                onBlur={() => saveColor(color)}
                className="text-sm border border-gray-100 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#3B82F6] bg-gray-50"
              >
                {COLOR_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {savingId === color.id && <Loader2 size={13} className="animate-spin text-gray-400" />}
              <button onClick={() => deleteColor(color.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Section 3: Typography ──────────────────────────────────────────────────

function TypographySection({ profileId: _profileId, fonts, onFontsChange, onMarkComplete, completed }: {
  profileId: string
  fonts: BrandFont[]
  onFontsChange: (f: BrandFont[]) => void
  onMarkComplete: (v: boolean) => void
  completed: boolean
}) {
  const [localFonts,  setLocalFonts]  = useState<BrandFont[]>(fonts)
  const [saving,      setSaving]      = useState<Record<string, boolean>>({})
  const [saved,       setSaved]       = useState<Record<string, boolean>>({})
  const [generating,  setGenerating]  = useState(false)
  const [pairings,    setPairings]    = useState<GeneratedPairing[] | null>(null)
  const [genError,    setGenError]    = useState<string | null>(null)

  useEffect(() => { setLocalFonts(fonts) }, [fonts])

  useEffect(() => {
    const hasHeading = localFonts.some(f => f.role === 'heading' && f.family)
    const hasBody    = localFonts.some(f => f.role === 'body'    && f.family)
    const done = hasHeading && hasBody
    if (done !== completed) onMarkComplete(done)
  }, [localFonts]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasFontsSet = localFonts.some(f => f.family?.trim())

  function getFont(role: string) {
    return localFonts.find(f => f.role === role) ?? null
  }

  function updateFont(role: string, field: keyof BrandFont, value: string) {
    setLocalFonts(prev => {
      const exists = prev.find(f => f.role === role)
      if (exists) return prev.map(f => f.role === role ? { ...f, [field]: value } : f)
      return [...prev, { id: '', role, family: '', weight: null, size_guide: null, source_url: null, notes: null, [field]: value }]
    })
  }

  async function saveFont(role: string) {
    const font = localFonts.find(f => f.role === role)
    if (!font?.family) return
    setSaving(prev => ({ ...prev, [role]: true }))
    try {
      await fetch('/api/brand-kit/fonts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: font.role, family: font.family, weight: font.weight, size_guide: font.size_guide, source_url: font.source_url, notes: font.notes }),
      })
      onFontsChange(localFonts)
      setSaved(prev => ({ ...prev, [role]: true }))
      setTimeout(() => setSaved(prev => ({ ...prev, [role]: false })), 2000)
    } finally {
      setSaving(prev => ({ ...prev, [role]: false }))
    }
  }

  async function generateFonts() {
    setGenerating(true)
    setGenError(null)
    setPairings(null)
    try {
      const res  = await fetch('/api/brand-kit/generate-fonts', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setGenError(data.error === 'INSUFFICIENT_CREDITS' ? 'Not enough credits (2 required).' : (data.error ?? 'Generation failed'))
        return
      }
      setPairings(data.pairings)
    } finally {
      setGenerating(false)
    }
  }

  function applyPairing(pairing: GeneratedPairing) {
    setLocalFonts(prev => {
      const next = [...prev]
      const applyRole = (role: string, def: GeneratedFontDef) => {
        const idx = next.findIndex(f => f.role === role)
        const updated = { id: idx >= 0 ? next[idx].id : '', role, family: def.family, weight: def.weight, size_guide: def.size_guide, source_url: null, notes: null }
        if (idx >= 0) next[idx] = updated
        else next.push(updated)
      }
      applyRole('heading', pairing.heading)
      applyRole('body', pairing.body)
      return next
    })
    setPairings(null)
  }

  return (
    <div className="space-y-5">
      {/* Empty state */}
      {!hasFontsSet && !pairings && (
        <div className="border border-dashed border-gray-200 rounded-2xl p-8 text-center">
          <Type size={24} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No fonts set yet.</p>
          <p className="text-xs text-gray-400 mb-5">Generate a pairing based on your brand or fill in the fields below.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={generateFonts}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2D3748] text-white text-sm font-medium rounded-xl hover:bg-[#1a2535] disabled:opacity-60 transition-colors"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {generating ? 'Generating…' : 'Generate with Maya'}
            </button>
          </div>
          {genError && <p className="text-xs text-red-500 mt-3">{genError}</p>}
        </div>
      )}

      {/* Pairing suggestions */}
      {pairings && (
        <div className="rounded-2xl border border-[#3B82F6]/20 bg-[#2D3748]/4 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Suggested pairings</p>
            <span className="text-xs text-gray-400">2 credits used</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {pairings.map((pairing, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{pairing.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{pairing.rationale}</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 w-16 flex-shrink-0">Heading</span>
                    <span className="text-sm font-medium text-gray-800">{pairing.heading.family}</span>
                    <span className="text-xs text-gray-400">{pairing.heading.weight}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 w-16 flex-shrink-0">Body</span>
                    <span className="text-sm text-gray-700">{pairing.body.family}</span>
                    <span className="text-xs text-gray-400">{pairing.body.weight}</span>
                  </div>
                </div>
                <button
                  onClick={() => applyPairing(pairing)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-[#2D3748] text-white rounded-xl hover:bg-[#1a2535] transition-colors"
                >
                  <Check size={13} /> Use this pairing
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateFonts}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:border-gray-400 disabled:opacity-50 transition-colors"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {generating ? 'Generating…' : 'Try again'}
            </button>
            <button
              onClick={() => setPairings(null)}
              className="px-4 py-2 border border-gray-200 text-gray-400 text-sm rounded-xl hover:border-gray-400 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Regenerate button when fonts exist */}
      {hasFontsSet && !pairings && (
        <div className="flex justify-end">
          <button
            onClick={generateFonts}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#2D3748] border border-gray-200 rounded-xl px-3 py-1.5 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {generating ? 'Generating…' : 'Suggest pairings'}
          </button>
        </div>
      )}
      {hasFontsSet && genError && <p className="text-xs text-red-500 mb-1">{genError}</p>}

      {/* Font role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FONT_ROLES.map(({ role, label, desc }) => {
          const font     = getFont(role)
          const isSaving = saving[role]
          const isSaved  = saved[role]
          return (
            <div key={role} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                {font?.family && (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Set</span>
                )}
              </div>
              <div className="space-y-2.5">
                <input
                  value={font?.family ?? ''}
                  onChange={e => updateFont(role, 'family', e.target.value)}
                  placeholder="Font family (e.g. Geist, Inter)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#3B82F6]"
                />
                <input
                  value={font?.weight ?? ''}
                  onChange={e => updateFont(role, 'weight', e.target.value)}
                  placeholder="Weights (e.g. 400, 600, 700)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#3B82F6]"
                />
                <input
                  value={font?.source_url ?? ''}
                  onChange={e => updateFont(role, 'source_url', e.target.value)}
                  placeholder="Source URL (Google Fonts, etc.)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#3B82F6]"
                />
                <textarea
                  value={font?.size_guide ?? ''}
                  onChange={e => updateFont(role, 'size_guide', e.target.value)}
                  placeholder="Size guide (e.g. H1: 48px, H2: 32px)"
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#3B82F6]"
                />
                <button
                  onClick={() => saveFont(role)}
                  disabled={!font?.family || isSaving}
                  className={`w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-xl transition-colors ${
                    isSaved ? 'bg-green-50 text-green-700' : 'bg-[#2D3748] text-white hover:bg-[#1a2535] disabled:opacity-40'
                  }`}
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : isSaved ? <><Check size={13} /> Saved</> : <><Save size={13} /> Save font</>}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Section 4: Imagery ─────────────────────────────────────────────────────

function ImagerySection({ profileId: _profileId, assets, documents, onAssetsChange, allAssets, onDocumentsChange: _onDocumentsChange, onMarkComplete, completed }: {
  profileId: string
  assets: BrandAsset[]
  documents: FoundationDoc[]
  onAssetsChange: (a: BrandAsset[]) => void
  allAssets: BrandAsset[]
  onDocumentsChange: (d: FoundationDoc[]) => void
  onMarkComplete: (v: boolean) => void
  completed: boolean
}) {
  const [style, setStyle]       = useState(() => documents.find(d => d.type === 'imagery_style')?.markdown ?? '')
  const [styleSaved, setStyleSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const done = style.trim().length > 20 || assets.length > 0
    if (done !== completed) onMarkComplete(done)
  }, [style, assets]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveStyle() {
    await fetch('/api/brand-kit/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'imagery_style', content: style }),
    })
    setStyleSaved(true)
    setTimeout(() => setStyleSaved(false), 2000)
  }

  async function uploadAsset(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('name', file.name)
      form.append('sectionKey', 'imagery')
      form.append('assetType', 'photo')
      const res  = await fetch('/api/brand-kit/assets', { method: 'POST', body: form })
      const data = await res.json()
      if (data.asset) onAssetsChange([...allAssets, data.asset])
    } finally {
      setUploading(false)
    }
  }

  async function deleteAsset(id: string) {
    await fetch(`/api/brand-kit/assets/${id}`, { method: 'DELETE' })
    onAssetsChange(allAssets.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Photography style</h2>
        <textarea
          value={style}
          onChange={e => setStyle(e.target.value)}
          placeholder="Describe your visual style. E.g., 'Clean, bright product photography on white backgrounds. Real people, not stock. Warm color grading. Avoid busy or cluttered backgrounds.'"
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-[#3B82F6]"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={saveStyle}
            disabled={!style.trim()}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              styleSaved ? 'bg-green-50 text-green-700' : 'bg-[#2D3748] text-white hover:bg-[#1a2535] disabled:opacity-40'
            }`}
          >
            {styleSaved ? <><Check size={13} /> Saved</> : <><Save size={13} /> Save</>}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Asset library</h2>

        {/* Upload zone */}
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-gray-400 transition-colors cursor-pointer mb-5"
        >
          {uploading ? <Loader2 size={24} className="text-gray-300 mx-auto mb-2 animate-spin" /> : <Upload size={24} className="text-gray-300 mx-auto mb-2" />}
          <p className="text-sm text-gray-500">{uploading ? 'Uploading…' : 'Drop files here or click to upload'}</p>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG, WebP up to 10MB</p>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { Array.from(e.target.files ?? []).forEach(uploadAsset); e.target.value = '' }} />
        </div>

        {/* Asset grid */}
        {assets.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {assets.map(asset => (
              <div key={asset.id} className="relative group">
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                  {asset.signed_url || asset.file_url || asset.thumbnail_url ? (
                    <img src={asset.signed_url ?? asset.thumbnail_url ?? asset.file_url ?? ''} alt={asset.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full"><ImageIcon size={24} className="text-gray-300" /></div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate">{asset.name}</p>
                <button
                  onClick={() => deleteAsset(asset.id)}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 bg-white rounded-lg p-1 shadow-sm transition-opacity"
                >
                  <Trash2 size={11} className="text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        )}
        {assets.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No assets uploaded yet.</p>}
      </div>
    </div>
  )
}

// ── Section 5: Voice & Messaging ───────────────────────────────────────────

function VoiceSection({ profileId: _profileId, documents, onDocumentsChange, onMarkComplete, completed }: {
  profileId: string
  documents: FoundationDoc[]
  onDocumentsChange: (d: FoundationDoc[]) => void
  onMarkComplete: (v: boolean) => void
  completed: boolean
}) {
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const foundationDone = FOUNDATION_DOC_TYPES.every(t => documents.find(d => d.type === t && d.markdown?.trim()))
    if (foundationDone !== completed) onMarkComplete(foundationDone)
  }, [documents]) // eslint-disable-line react-hooks/exhaustive-deps

  function getDoc(type: string) {
    return documents.find(d => d.type === type) ?? null
  }

  async function saveDocument(type: string, content: string) {
    await fetch('/api/brand-kit/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content }),
    })
    onDocumentsChange(documents.map(d => d.type === type ? { ...d, markdown: content } : d)
      .concat(documents.find(d => d.type === type) ? [] : [{ id: '', type, title: null, markdown: content, version: 1 }])
    )
  }

  async function handleRegenerate(docType: string) {
    setRegenerating(prev => ({ ...prev, [docType]: true }))
    try {
      const res  = await fetch('/api/brand-kit/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType }),
      })
      const data = await res.json()
      if (data.content) {
        onDocumentsChange(documents.map(d => d.type === docType ? { ...d, markdown: data.content } : d)
          .concat(documents.find(d => d.type === docType) ? [] : [{ id: '', type: docType, title: null, markdown: data.content, version: 1 }])
        )
      }
    } finally {
      setRegenerating(prev => ({ ...prev, [docType]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Foundation documents</p>
      {FOUNDATION_DOC_TYPES.map(type => (
        <DocumentCard
          key={type}
          doc={getDoc(type)}
          title={FOUNDATION_DOC_LABELS[type] ?? type}
          isFoundation
          regenerating={regenerating[type] ?? false}
          onSave={content => saveDocument(type, content)}
          onRegenerate={() => handleRegenerate(type)}
        />
      ))}

      <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold pt-4">Additional messaging</p>
      {ADDITIONAL_DOC_TYPES.map(({ type, title, placeholder }) => (
        <DocumentCard
          key={type}
          doc={getDoc(type)}
          title={title}
          placeholder={placeholder}
          isFoundation={false}
          regenerating={false}
          onSave={content => saveDocument(type, content)}
          onRegenerate={() => {}}
        />
      ))}
    </div>
  )
}

function DocumentCard({ doc, title, placeholder, isFoundation, regenerating, onSave, onRegenerate }: {
  doc: FoundationDoc | null
  title: string
  placeholder?: string
  isFoundation: boolean
  regenerating: boolean
  onSave: (content: string) => void
  onRegenerate: () => void
}) {
  const [editing,  setEditing]  = useState(false)
  const [content,  setContent]  = useState(doc?.markdown ?? '')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  useEffect(() => { setContent(doc?.markdown ?? '') }, [doc?.markdown])

  async function handleSave() {
    setSaving(true)
    await onSave(content)
    setSaving(false)
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {doc?.version && <p className="text-xs text-gray-400 mt-0.5">Version {doc.version}</p>}
        </div>
        <div className="flex gap-2">
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="text-xs font-medium text-gray-600 hover:text-black px-3 py-1.5 border border-gray-200 rounded-lg transition-colors">
              Edit
            </button>
          )}
          {isFoundation && (
            <button onClick={onRegenerate} disabled={regenerating}
              className="text-xs font-medium text-gray-600 hover:text-black px-3 py-1.5 border border-gray-200 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50">
              {regenerating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={placeholder}
            rows={8}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-[#2D3748]"
          />
          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2D3748] text-white text-sm font-medium rounded-xl disabled:opacity-60">
              {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : <Save size={13} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setContent(doc?.markdown ?? ''); setEditing(false) }}
              className="px-4 py-2 border border-gray-200 text-sm rounded-xl hover:border-gray-400 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {doc?.markdown?.trim() ? doc.markdown : (
            <span className="text-gray-400 italic">
              {isFoundation ? 'Not yet generated — click Regenerate to have Maya write this.' : `Not yet written — click Edit to add.${placeholder ? ` ${placeholder}` : ''}`}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Section 6: Templates ───────────────────────────────────────────────────

function TemplatesSection({ profileId: _profileId, assets, onAssetsChange, allAssets, onMarkComplete, completed }: {
  profileId: string
  assets: BrandAsset[]
  onAssetsChange: (a: BrandAsset[]) => void
  allAssets: BrandAsset[]
  onMarkComplete: (v: boolean) => void
  completed: boolean
}) {
  const [newName,    setNewName]    = useState('')
  const [newUrl,     setNewUrl]     = useState('')
  const [newType,    setNewType]    = useState('template_canva')
  const [adding,     setAdding]     = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (assets.length > 0 !== completed) onMarkComplete(assets.length > 0)
  }, [assets]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addTemplate() {
    if (!newUrl.trim() || !newName.trim()) return
    setAdding(true)
    try {
      const res  = await fetch('/api/brand-kit/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, section_key: 'templates', asset_type: newType, external_url: newUrl }),
      })
      const data = await res.json()
      if (data.asset) onAssetsChange([...allAssets, data.asset])
      setNewName('')
      setNewUrl('')
    } finally {
      setAdding(false)
    }
  }

  async function uploadTemplate(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('name', file.name)
      form.append('sectionKey', 'templates')
      form.append('assetType', 'other')
      const res  = await fetch('/api/brand-kit/assets', { method: 'POST', body: form })
      const data = await res.json()
      if (data.asset) onAssetsChange([...allAssets, data.asset])
    } finally {
      setUploading(false)
    }
  }

  async function deleteAsset(id: string) {
    await fetch(`/api/brand-kit/assets/${id}`, { method: 'DELETE' })
    onAssetsChange(allAssets.filter(a => a.id !== id))
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-5">Add a template</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Template name"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#3B82F6]"
          />
          <select
            value={newType}
            onChange={e => setNewType(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#3B82F6]"
          >
            {TEMPLATE_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
          <input
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTemplate() }}
            placeholder={TEMPLATE_TYPES.find(t => t.type === newType)?.placeholder ?? 'URL'}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={addTemplate}
            disabled={adding || !newName.trim() || !newUrl.trim()}
            className="flex items-center gap-1.5 text-sm font-medium bg-[#2D3748] text-white px-4 py-2 rounded-xl hover:bg-[#1a2535] disabled:opacity-40 transition-colors"
          >
            {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add link
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-sm font-medium border border-gray-200 text-gray-600 px-4 py-2 rounded-xl hover:border-gray-400 disabled:opacity-40 transition-colors"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Upload file
          </button>
          <input ref={fileRef} type="file" accept=".pdf,.ppt,.pptx,.key" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplate(f); e.target.value = '' }} />
        </div>
      </div>

      {assets.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Templates ({assets.length})</h2>
          <div className="space-y-2">
            {assets.map(asset => (
              <div key={asset.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <Layout size={14} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
                  <p className="text-xs text-gray-400 truncate">{asset.external_url ?? 'Uploaded file'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {asset.external_url && (
                    <a href={asset.external_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-black px-3 py-1.5 border border-gray-200 rounded-lg">
                      Open →
                    </a>
                  )}
                  {(asset.signed_url || asset.file_url) && (
                    <a href={asset.signed_url ?? asset.file_url ?? ''} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-black px-3 py-1.5 border border-gray-200 rounded-lg">
                      Download →
                    </a>
                  )}
                  <button onClick={() => deleteAsset(asset.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
