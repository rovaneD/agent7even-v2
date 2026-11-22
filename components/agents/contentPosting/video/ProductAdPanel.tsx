'use client'

import { useEffect, useState } from 'react'
import { Clock, Download, ImagePlus, Loader2, RotateCcw, X } from 'lucide-react'
import { VIDEO_TYPES, videoTypeById, type VideoTypeId } from '@/lib/agents/contentPosting/videoTypes'
import { VIDEO_TYPE_ICONS, VideoTypePoster, useExampleUrl } from './videoTypeVisuals'
import { Segmented, fieldClass } from './ui'
import { useVideoJobPoll } from './useVideoJobPoll'

type Option = 'clean' | 'creative' | 'signature'
type StillKey = 'hero' | 'angle' | 'group' | 'lifestyle' | 'texture' | 'apply' | 'wetGlass'
type Look = 'auto' | 'wetGlass' | 'shadow' | 'silk' | 'water'
const LOOK_LABELS: Record<Exclude<Look, 'auto'>, string> = { wetGlass: 'Wet glass', shadow: 'Shadow play', silk: 'Silk', water: 'Water ripple' }
type Photo = { path: string; url: string }
type Check = { passed: boolean; issues: string[] }
type Job = { taskId: string; status: 'starting' | 'rendering' | 'editing' | 'completed' | 'failed'; videoUrl?: string | null }

// Placeholder prices (owner to set): keep in step with ACTION_CREDIT_COST product_ad_*.
const STILLS_CREDITS = 5
const VIDEO_CREDITS: Record<Option, number> = { clean: 55, creative: 70, signature: 70 }
const READY: Option[] = ['clean', 'creative', 'signature']
const OPTION_HINT: Record<Option, string> = {
  clean: 'Clean: steady studio shots, a smooth push onto each label, hard cuts.',
  creative: 'Creative: your product meets its texture, a reveal onto the label, loops back to the start.',
  signature: 'Signature: fast cuts, stop-motion beats, a slow reveal onto your label.',
}

const STILL_LABELS: Record<StillKey, string> = {
  hero: 'Label shot',
  angle: 'At an angle',
  group: 'All products',
  lifestyle: 'Flat lay',
  texture: 'Texture',
  apply: 'Spreading',
  wetGlass: 'Wet glass',
}
const STILL_ORDER: StillKey[] = ['hero', 'angle', 'group', 'lifestyle', 'texture', 'apply', 'wetGlass']

/**
 * Phone photos are often 5-12 MB; send a 2400px JPEG (the request limit is ~4.5 MB). 2400 not 1600 so
 * the label's small print stays readable for the stills and the product check.
 */
async function downsize(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('resize failed'))), 'image/jpeg', 0.9))
}

/** Product ad (no person): photos -> stills to check -> the video. Its own panel; no plan step. */
export default function ProductAdPanel({ onClose, onSwitch }: { onClose: () => void; onSwitch: (id: VideoTypeId) => void }) {
  const type = videoTypeById('product_ad')!
  const Icon = VIDEO_TYPE_ICONS.product_ad
  const exampleUrl = useExampleUrl(type)

  const [option, setOption] = useState<Option>('signature')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [name, setName] = useState('')
  const [details, setDetails] = useState('')
  const [leadProduct, setLeadProduct] = useState('')
  const [look, setLook] = useState<Look>('auto')
  const [madeLook, setMadeLook] = useState<Exclude<Look, 'auto'> | null>(null)
  const [checks, setChecks] = useState<Partial<Record<StillKey, Check>>>({})
  const [checking, setChecking] = useState(false)
  const [stills, setStills] = useState<{ taskId: string; urls: Partial<Record<StillKey, string | null>>; redosLeft: number } | null>(null)
  const [busy, setBusy] = useState<null | 'all' | StillKey>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<StillKey>('hero')

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    setUploading(true)
    try {
      for (const f of Array.from(files).slice(0, 4 - photos.length)) {
        const form = new FormData()
        form.append('file', new File([await downsize(f)], 'photo.jpg', { type: 'image/jpeg' }))
        const r = await fetch('/api/posts/video-product', { method: 'POST', body: form })
        const d = (await r.json().catch(() => ({}))) as { path?: string; url?: string; message?: string }
        if (!r.ok || !d.path || !d.url) throw new Error(d.message ?? 'The photo could not be uploaded.')
        setPhotos(p => [...p, { path: d.path!, url: d.url! }])
      }
      setStills(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The photo could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }

  async function makeStills() {
    if (!photos.length) return setError('Add at least one photo of your product.')
    if (!name.trim()) return setError('Say what the product is.')
    setError(null)
    setBusy('all')
    try {
      const r = await fetch('/api/posts/video-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stills', option, productName: name, details, leadProduct, revealLook: look, photos: photos.map(p => p.path) }),
      })
      const d = (await r.json().catch(() => ({}))) as { taskId?: string; stills?: Partial<Record<StillKey, string | null>>; revealLook?: Exclude<Look, 'auto'>; redosLeft?: number; message?: string }
      if (!r.ok || !d.taskId || !d.stills) throw new Error(d.message ?? 'The stills could not be made.')
      setMadeLook(d.revealLook ?? null)
      setStills({ taskId: d.taskId, urls: d.stills, redosLeft: d.redosLeft ?? 0 })
      setPreview('hero')
      setBusy(null)
      void runChecks(d.taskId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The stills could not be made.')
    } finally {
      setBusy(null)
    }
  }

  /**
   * Automatic product check: compare every still with the user's photos; remake a failing still once for
   * free, check it again, and flag anything that still fails so the user looks at it first.
   */
  async function runChecks(taskId: string) {
    setChecking(true)
    const post = async (body: Record<string, unknown>) => {
      const r = await fetch('/api/posts/video-product', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, ...body }) })
      return (await r.json().catch(() => ({}))) as { checks?: Partial<Record<StillKey, Check>>; autoRedone?: StillKey[]; stills?: Partial<Record<StillKey, string | null>>; redosLeft?: number }
    }
    try {
      const first = await post({ action: 'check' })
      setChecks(first.checks ?? {})
      const failed = (Object.entries(first.checks ?? {}) as Array<[StillKey, Check]>).filter(([k, c]) => !c.passed && !(first.autoRedone ?? []).includes(k)).map(([k]) => k)
      if (!failed.length) return
      for (const k of failed) {
        setBusy(k)
        const d = await post({ action: 'redo', which: k, auto: true })
        if (d.stills) setStills(st => (st ? { ...st, urls: d.stills!, redosLeft: d.redosLeft ?? st.redosLeft } : st))
      }
      setBusy(null)
      const again = await post({ action: 'check', keys: failed.includes('hero') ? [...failed, 'wetGlass'] : failed })
      setChecks(again.checks ?? {})
    } catch {
      // The check never blocks the user; they still review every still.
    } finally {
      setBusy(null)
      setChecking(false)
    }
  }

  async function redo(key: StillKey) {
    if (!stills || stills.redosLeft <= 0) return
    setError(null)
    setBusy(key)
    try {
      const r = await fetch('/api/posts/video-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redo', taskId: stills.taskId, which: key }),
      })
      const d = (await r.json().catch(() => ({}))) as { stills?: Partial<Record<StillKey, string | null>>; redosLeft?: number; message?: string }
      if (!r.ok || !d.stills) throw new Error(d.message ?? 'That still could not be remade.')
      setStills(s => (s ? { ...s, urls: d.stills!, redosLeft: d.redosLeft ?? 0 } : s))
      setPreview(key)
      setChecks(c => { const n = { ...c }; delete n[key]; if (key === 'hero') delete n.wetGlass; return n })
      if (stills) {
        void fetch('/api/posts/video-product', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check', taskId: stills.taskId, keys: key === 'hero' ? ['hero', 'wetGlass'] : [key] }) })
          .then(r => r.json())
          .then((x: { checks?: Partial<Record<StillKey, Check>> }) => x.checks && setChecks(x.checks))
          .catch(() => {})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That still could not be remade.')
    } finally {
      setBusy(null)
    }
  }

  async function create() {
    if (!stills) return
    setError(null)
    setJob({ taskId: stills.taskId, status: 'starting' })
    try {
      const r = await fetch('/api/posts/video-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', taskId: stills.taskId }),
      })
      const d = (await r.json().catch(() => ({}))) as { taskId?: string; message?: string }
      if (!r.ok || !d.taskId) throw new Error(d.message ?? 'The video could not be started.')
      setJob({ taskId: d.taskId, status: 'rendering' })
    } catch (e) {
      setJob(null)
      setError(e instanceof Error ? e.message : 'The video could not be started.')
    }
  }

  // Poll every 12s; the poll also moves the video forward (clips -> edit -> Approvals).
  // A failed read schedules another. One dropped response used to stop the chain.
  useVideoJobPoll(job, setJob, '/api/posts/video-product')

  const stillKeys = STILL_ORDER.filter(k => stills?.urls[k] !== undefined)
  const previewUrl = stills?.urls[preview] ?? null

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/80 backdrop-blur-md lg:overflow-hidden" role="dialog" aria-modal="true" aria-label={type.name}>
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: `radial-gradient(60% 60% at 35% 40%, ${type.poster[0]} 0%, transparent 70%)` }} />
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white lg:hidden">
        <X size={18} />
      </button>

      <div className="relative flex min-h-full flex-col lg:h-full lg:flex-row">
        {/* Left: example, then the still being checked, then the finished video */}
        <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-6 py-6 lg:py-8">
          <div className="relative aspect-[9/16] h-[56vh] max-h-[760px] overflow-hidden rounded-[20px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10 lg:h-[76vh]">
            {job?.status === 'completed' && job.videoUrl ? (
              <video src={job.videoUrl} className="absolute inset-0 h-full w-full object-cover" controls autoPlay loop playsInline />
            ) : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={STILL_LABELS[preview]} className="absolute inset-0 h-full w-full object-cover" />
            ) : exampleUrl ? (
              <>
                <video src={exampleUrl} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline />
                <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11.5px] font-medium text-white backdrop-blur">Example · Signature</span>
              </>
            ) : (
              <VideoTypePoster type={type} size="player" />
            )}
          </div>
          <p className="-mb-2 text-[11px] text-[#6B6E76]">Examples of each video type</p>
          <div className="flex gap-2" role="tablist" aria-label="Video types">
            {VIDEO_TYPES.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === type.id}
                aria-label={t.name}
                onClick={() => onSwitch(t.id)}
                className={`relative h-[60px] w-[40px] overflow-hidden rounded-[7px] transition-all ${t.id === type.id ? 'ring-2 ring-white' : 'opacity-60 ring-1 ring-white/10 hover:opacity-100'}`}
              >
                <VideoTypePoster type={t} size="thumb" playing={false} />
              </button>
            ))}
          </div>
        </div>

        {/* Right: guided panel */}
        <div className="relative flex w-full flex-col p-3 lg:h-full lg:w-[420px] lg:flex-shrink-0">
          <div className="flex flex-1 flex-col overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#151619] lg:min-h-0">
            <div className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-4">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-white/[0.08] text-white">
                <Icon size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-white">{type.name}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-[#9A9DA5]">{type.tagline}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[#C9CBD1] transition-colors hover:bg-white/[0.14] hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 lg:min-h-0">
              <section>
                <p className="mb-2 text-[12.5px] font-medium text-[#C9CBD1]">Style</p>
                <Segmented
                  label="Style"
                  value={option}
                  onChange={v => { if (READY.includes(v)) { setOption(v); setStills(null) } else setError(`${v === 'clean' ? 'Clean' : 'Creative'} is coming soon.`) }}
                  options={[
                    { value: 'clean' as Option, label: 'Clean' },
                    { value: 'creative' as Option, label: 'Creative' },
                    { value: 'signature' as Option, label: 'Signature' },
                  ]}
                />
                <p className="mt-1.5 text-[11.5px] leading-snug text-[#6B6E76]">{OPTION_HINT[option]}</p>
              </section>

              {/* Reveal look picker hidden (owner 2026-11-03): wet glass only until variety is redesigned. */}

              <section>
                <p className="mb-2 text-[12.5px] font-medium text-[#C9CBD1]">Your product photos (1–4)</p>
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((p, i) => (
                    <div key={p.path} className="relative aspect-square overflow-hidden rounded-[8px] ring-1 ring-white/[0.08]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                      {!stills && (
                        <button type="button" aria-label="Remove photo" onClick={() => setPhotos(ps => ps.filter(x => x.path !== p.path))} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white">
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                  {photos.length < 4 && !stills && (
                    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[8px] border border-dashed border-white/[0.15] text-[11px] text-[#9A9DA5] hover:border-white/30 hover:text-white">
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                      {uploading ? 'Uploading' : 'Add'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" disabled={uploading} onChange={e => { void addPhotos(e.target.files); e.target.value = '' }} />
                    </label>
                  )}
                </div>
                <p className="mt-1.5 text-[11.5px] leading-snug text-[#6B6E76]">Clear photos with the label readable. A plain background is fine.</p>
              </section>

              <section className="space-y-3">
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-[#C9CBD1]">What is it?</p>
                  <input value={name} disabled={!!stills} onChange={e => setName(e.target.value)} placeholder="e.g. Milky body lotion" className={fieldClass} />
                </div>
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-[#C9CBD1]">Lead product (if there are several)</p>
                  <input value={leadProduct} disabled={!!stills} onChange={e => setLeadProduct(e.target.value)} placeholder="e.g. the vitamin C serum. It gets the label shot and the wet-glass reveal." className={fieldClass} />
                </div>
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-[#C9CBD1]">What the texture looks like, and ingredients (optional)</p>
                  <textarea value={details} disabled={!!stills} onChange={e => setDetails(e.target.value)} rows={2} placeholder="e.g. clear orange serum, rich white cream; with vitamin C. Only what you list here appears in the video." className={`${fieldClass} resize-none`} />
                </div>
              </section>

              {stills && (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[12px] font-medium text-[#9A9DA5]">{checking ? 'Checking each still against your photos…' : 'Stills · check every label before filming'}</p>
                    <span className="text-[11.5px] text-[#6B6E76]">{stills.redosLeft} redo{stills.redosLeft === 1 ? '' : 's'} left</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {stillKeys.map(k => (
                      <div key={k} className="space-y-1">
                        <button type="button" onClick={() => setPreview(k)} className={`relative block aspect-[9/16] w-full overflow-hidden rounded-[8px] bg-white/[0.04] ${preview === k ? 'ring-2 ring-white' : 'ring-1 ring-white/[0.08]'}`}>
                          {stills.urls[k] && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={stills.urls[k]!} alt={STILL_LABELS[k]} className="h-full w-full object-cover" />
                          )}
                          {busy === k && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader2 size={16} className="animate-spin text-white" /></span>
                          )}
                        </button>
                        <p className="truncate text-[10.5px] text-[#9A9DA5]">{k === 'wetGlass' && madeLook ? LOOK_LABELS[madeLook] : STILL_LABELS[k]}</p>
                        {checks[k] && (
                          <p className={`text-[10px] leading-tight ${checks[k]!.passed ? 'text-[#4ADE80]' : 'text-[#F5C26B]'}`} title={checks[k]!.issues.join(' · ')}>
                            {checks[k]!.passed ? '✓ Matches your photo' : `Check: ${checks[k]!.issues[0] ?? 'looks different from your photo'}`}
                          </p>
                        )}
                        <button type="button" onClick={() => redo(k)} disabled={stills.redosLeft <= 0 || busy !== null || !!job} className="inline-flex items-center gap-1 text-[11px] text-[#7FB0FF] hover:text-white disabled:opacity-40">
                          <RotateCcw size={10} /> Redo
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
              <div className="mb-3 flex items-center justify-center gap-4 text-[12.5px] text-[#9A9DA5]">
                <span className="inline-flex items-center gap-1.5"><Clock size={13} /> ~{type.minutes} min</span>
                <span className="h-3 w-px bg-white/10" />
                <span>No voice · add a sound when you post</span>
              </div>
              {error && <p className="mb-2 text-center text-[12.5px] text-[#FF8A8A]">{error}</p>}

              {job ? (
                <div className="rounded-[12px] bg-white/[0.04] p-3 ring-1 ring-white/[0.06]">
                  {(['starting', 'rendering', 'editing', 'completed'] as const).map((st, i) => {
                    const order = ['starting', 'rendering', 'editing', 'completed']
                    const now = order.indexOf(job.status)
                    const done = job.status !== 'failed' && i < now
                    const active = job.status === st && st !== 'completed'
                    const label = ['Starting', `Filming the texture${option === 'clean' ? '' : ' and the reveal'} (about 5 min)`, `Cutting the ${option === 'clean' ? 'Clean' : option === 'creative' ? 'Creative' : 'Signature'} edit`, 'In Approvals'][i]
                    return (
                      <div key={st} className="flex items-center gap-2 py-1 text-[13px]">
                        {done || (st === 'completed' && job.status === 'completed') ? (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#16A34A] text-[10px] text-white">✓</span>
                        ) : active ? (
                          <Loader2 size={15} className="animate-spin text-[#7FB0FF]" />
                        ) : (
                          <span className="h-4 w-4 rounded-full border border-white/20" />
                        )}
                        <span className={done || active || job.status === 'completed' ? 'text-white' : 'text-[#6B6E76]'}>{label}</span>
                      </div>
                    )
                  })}
                  {job.status === 'failed' && <p className="mt-2 text-[12.5px] text-[#FF8A8A]">The video failed. Your credits were refunded automatically.</p>}
                  {job.status === 'completed' ? (
                    <div className="mt-3 space-y-2">
                      {job.videoUrl && (
                        <a href={job.videoUrl} download className="flex items-center justify-center gap-2 rounded-[10px] bg-white/[0.08] py-2.5 text-[14px] font-semibold text-white hover:bg-white/[0.14]">
                          <Download size={15} /> Download
                        </a>
                      )}
                      <a href="/dashboard/agents/approvals" className="block rounded-[10px] bg-brand-primary py-2.5 text-center text-[14px] font-semibold text-white hover:bg-[#1D62D6]">Open Approvals</a>
                      <p className="text-center text-[11.5px] leading-snug text-[#6B6E76]">The video has no sound. Add one from the Instagram or TikTok sound library when you post.</p>
                    </div>
                  ) : job.status !== 'failed' ? (
                    <p className="mt-2 text-[11.5px] text-[#6B6E76]">You can close this. The video keeps going and lands in Approvals.</p>
                  ) : null}
                </div>
              ) : !stills ? (
                <>
                  <button
                    type="button"
                    onClick={makeStills}
                    disabled={busy !== null || uploading || !photos.length || !name.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-brand-primary py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#1D62D6] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-[#8A8D95]"
                  >
                    {busy === 'all' && <Loader2 size={16} className="animate-spin" />}
                    {busy === 'all' ? 'Making the stills (about 1 min)…' : `Make stills · ${STILLS_CREDITS} credits`}
                  </button>
                  <p className="mt-2 text-center text-[11.5px] leading-snug text-[#6B6E76]">
                    You check every still before filming. Filming is {VIDEO_CREDITS[option]} credits more ({STILLS_CREDITS + VIDEO_CREDITS[option]} in total).
                  </p>
                </>
              ) : (
                <>
                  <button type="button" onClick={create} disabled={busy !== null || checking} className="w-full rounded-[12px] bg-brand-primary py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#1D62D6] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-[#8A8D95]">
                    Make the video · {VIDEO_CREDITS[option]} credits
                  </button>
                  <p className="mt-2 text-center text-[11.5px] leading-snug text-[#6B6E76]">Charged once. If the video fails, all its credits come back automatically.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
