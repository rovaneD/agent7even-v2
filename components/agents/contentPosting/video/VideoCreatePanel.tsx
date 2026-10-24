'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Clock, Loader2, RotateCcw, UserRound, X } from 'lucide-react'
import { contentPostingModeHref, type VideoFormatSpec } from '@/lib/agents/contentPosting/platformFormats'
import {
  VIDEO_TYPES,
  videoTypeById,
  type CaptionChoice,
  type VideoTypeField,
  type VideoTypeId,
} from '@/lib/agents/contentPosting/videoTypes'
import { VIDEO_TYPE_ICONS, VideoTypePoster } from './videoTypeVisuals'
import { Segmented, fieldClass } from './ui'
import CreatorsSheet, { loadLibrary, readSavedCreator, saveCreator, type PickedCreator } from './CreatorsSheet'

type Plan = {
  title: string
  beats: Array<{ text: string; visual: string }>
  endCard: string
  notes: string[]
}

type Props = {
  typeId: VideoTypeId
  format: VideoFormatSpec
  onClose: () => void
  onSwitch: (id: VideoTypeId) => void
}

/** Video types whose Approve & create is live (presenter pipeline). */
const PRESENTER_CREATE_TYPES = new Set(['presenter_tip', 'product_showcase'])

const CAPTION_LABELS: Record<CaptionChoice, string> = { off: 'Off', serif: 'Serif', sans: 'Sans' }
const CAPTION_FONTS: Record<Exclude<CaptionChoice, 'off'>, string> = {
  serif: '"A7 Caption Serif", Georgia, serif',
  sans: '"A7 Caption Sans", ui-sans-serif, system-ui, sans-serif',
}

function initialInputs(fields: VideoTypeField[]): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const f of fields) {
    if (f.kind === 'choice') out[f.key] = f.default
    else if (f.kind === 'multi') out[f.key] = [...f.default]
    else out[f.key] = ''
  }
  return out
}

/** Video Post, step 4: example on the left, guided panel on the right. Plan is free; create is the only charge. */
export default function VideoCreatePanel({ typeId, format, onClose, onSwitch }: Props) {
  const type = videoTypeById(typeId)!
  const index = VIDEO_TYPES.findIndex(t => t.id === typeId)
  const Icon = VIDEO_TYPE_ICONS[type.id]

  const [inputs, setInputs] = useState(() => initialInputs(type.fields))
  const [length, setLength] = useState(type.defaultLength)
  const [captions, setCaptions] = useState<CaptionChoice>(type.captionsDefault)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [creator, setCreator] = useState<PickedCreator | null>(() => readSavedCreator())
  const [sheetOpen, setSheetOpen] = useState(false)

  // Signed photo URLs expire, so a remembered creator only stores its id; refresh the photo here.
  useEffect(() => {
    if (!creator || creator.photoUrl) return
    loadLibrary()
      .then(lib => {
        const found =
          creator.kind === 'cast' ? lib.cast.find(c => c.id === creator.id) : lib.mine.find(c => c.id === creator.id)
        if (found) setCreator({ ...creator, name: found.name, photoUrl: found.photoUrl })
        else setCreator(null)
      })
      .catch(() => {})
  }, [creator])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<{ taskId: string; status: 'starting' | 'rendering' | 'editing' | 'completed' | 'failed'; videoUrl?: string | null } | null>(null)
  const creditsFor = length >= 30 ? 30 : 15
  const canCreate = PRESENTER_CREATE_TYPES.has(type.id)

  // Poll a running video every 12s until it is done or failed.
  useEffect(() => {
    if (!job || !['rendering', 'editing'].includes(job.status)) return
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/posts/video-create?taskId=${encodeURIComponent(job.taskId)}`)
        const d = (await r.json()) as { status?: string; videoUrl?: string | null }
        if (d.status === 'completed' || d.status === 'failed' || d.status === 'rendering' || d.status === 'editing') {
          setJob(j => (j ? { ...j, status: d.status as 'completed', videoUrl: d.videoUrl ?? j.videoUrl } : j))
        }
      } catch {}
    }, 12_000)
    return () => clearTimeout(t)
  }, [job])

  async function approveAndCreate() {
    if (!plan || !creator) return
    if (creator.kind !== 'cast') {
      setError('Voices for your own creators are coming soon. Pick one of our creators for now.')
      return
    }
    setError(null)
    setJob({ taskId: '', status: 'starting' })
    try {
      const res = await fetch('/api/posts/video-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeId: type.id,
          creatorId: creator.id,
          lines: plan.beats.map(b => b.text),
          length,
          captions,
          endCardText: plan.endCard,
          formatId: format.id,
          title: plan.title,
        }),
      })
      const d = (await res.json().catch(() => ({}))) as { taskId?: string; message?: string }
      if (!res.ok || !d.taskId) throw new Error(d.message ?? 'The video could not be started.')
      setJob({ taskId: d.taskId, status: 'rendering' })
    } catch (e) {
      setJob(null)
      setError(e instanceof Error ? e.message : 'The video could not be started.')
    }
  }

  const go = useCallback(
    (delta: number) => {
      const next = VIDEO_TYPES[(index + delta + VIDEO_TYPES.length) % VIDEO_TYPES.length]!
      onSwitch(next.id)
    },
    [index, onSwitch],
  )

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (sheetOpen) return
      if (e.key === 'Escape') onClose()
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [go, onClose, sheetOpen])

  const missing = useMemo(
    () =>
      type.fields.filter(f => {
        if (!('required' in f) || !f.required) return false
        const v = inputs[f.key]
        return typeof v === 'string' ? !v.trim() : !v?.length
      }),
    [type.fields, inputs],
  )

  async function makePlan() {
    if (missing.length) {
      setError(`Add "${missing[0]!.label}" first.`)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/posts/video-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typeId: type.id, inputs, length }),
      })
      const data = (await res.json().catch(() => ({}))) as { plan?: Plan; message?: string }
      if (!res.ok || !data.plan) throw new Error(data.message ?? 'Maya could not write a plan. Try again.')
      setPlan(data.plan)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Maya could not write a plan. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function setField(key: string, value: string | string[]) {
    setInputs(prev => ({ ...prev, [key]: value }))
    setPlan(null)
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/80 backdrop-blur-md lg:overflow-hidden" role="dialog" aria-modal="true" aria-label={type.name}>
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: `radial-gradient(60% 60% at 35% 40%, ${type.poster[0]} 0%, transparent 70%)` }}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white lg:hidden"
      >
        <X size={18} />
      </button>

      <div className="relative flex min-h-full flex-col lg:h-full lg:flex-row">
        {/* Left: example / preview */}
        <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-14 py-6 lg:py-8">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous video type"
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[10px] bg-white/[0.08] text-white transition-colors hover:bg-white/[0.16]"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next video type"
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[10px] bg-white/[0.08] text-white transition-colors hover:bg-white/[0.16]"
          >
            <ChevronRight size={20} />
          </button>

          <div className="relative aspect-[9/16] h-[56vh] max-h-[760px] overflow-hidden rounded-[20px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10 lg:h-[76vh]">
            {job?.status === 'completed' && job.videoUrl ? (
              <video src={job.videoUrl} className="absolute inset-0 h-full w-full object-cover" controls autoPlay playsInline />
            ) : type.presenter && creator?.photoUrl && !type.exampleUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={creator.photoUrl} alt={creator.name} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <VideoTypePoster type={type} size="player" />
            )}
            {captions !== 'off' && job?.status !== 'completed' && (
              <p
                className="pointer-events-none absolute inset-x-0 top-[73%] text-center text-white"
                style={{
                  fontFamily: CAPTION_FONTS[captions],
                  fontWeight: captions === 'serif' ? 600 : 700,
                  lineHeight: 1.15,
                  fontSize: captions === 'serif' ? 'clamp(20px, 3.6vh, 34px)' : 'clamp(17px, 3vh, 28px)',
                  textShadow: '0 0 3px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.6)',
                }}
              >
                {plan?.beats[0]?.text.split(/\s+/).slice(0, 3).join(' ') || 'Your captions here'}
              </p>
            )}
          </div>

          <div className="flex gap-2" role="tablist" aria-label="Video types">
            {VIDEO_TYPES.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === type.id}
                aria-label={t.name}
                onClick={() => onSwitch(t.id)}
                className={`relative h-[60px] w-[40px] overflow-hidden rounded-[7px] transition-all ${
                  t.id === type.id ? 'ring-2 ring-white' : 'opacity-60 ring-1 ring-white/10 hover:opacity-100'
                }`}
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
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[#C9CBD1] transition-colors hover:bg-white/[0.14] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 lg:min-h-0">
              {type.presenter && (
                <section>
                  <p className="mb-2 text-[12px] font-medium text-[#9A9DA5]">Creator</p>
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    className="flex w-full items-center gap-3 rounded-[12px] bg-white/[0.03] p-2.5 text-left ring-1 ring-white/[0.08] transition-colors hover:ring-white/20"
                  >
                    {creator?.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={creator.photoUrl} alt="" className="h-[60px] w-10 flex-shrink-0 rounded-[8px] object-cover" />
                    ) : (
                      <span className="flex h-[60px] w-10 flex-shrink-0 items-center justify-center rounded-[8px] bg-white/[0.06] text-[#8A8D95]">
                        <UserRound size={18} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-white">{creator ? creator.name : 'Choose a creator'}</span>
                      <span className="block text-[12px] text-[#8A8D95]">
                        {creator ? 'Same face in every video' : 'Pick one of ours or create your own'}
                      </span>
                    </span>
                    <span className="text-[12.5px] text-[#7FB0FF]">{creator ? 'Change' : 'Choose'}</span>
                  </button>
                </section>
              )}

              {type.fields.map(f => (
                <section key={f.key}>
                  <label htmlFor={`vf-${f.key}`} className="mb-2 block text-[12px] font-medium text-[#9A9DA5]">
                    {f.label}
                  </label>
                  {f.kind === 'text' && (
                    <input
                      id={`vf-${f.key}`}
                      value={String(inputs[f.key] ?? '')}
                      onChange={e => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className={fieldClass}
                    />
                  )}
                  {f.kind === 'textarea' && (
                    <textarea
                      id={`vf-${f.key}`}
                      value={String(inputs[f.key] ?? '')}
                      onChange={e => setField(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      rows={3}
                      className={fieldClass}
                    />
                  )}
                  {f.kind === 'choice' && (
                    <Segmented
                      label={f.label}
                      value={String(inputs[f.key])}
                      options={f.options.map(o => ({ value: o, label: o }))}
                      onChange={v => setField(f.key, v)}
                    />
                  )}
                  {f.kind === 'multi' && (
                    <div className="flex flex-wrap gap-2" id={`vf-${f.key}`}>
                      {f.options.map(o => {
                        const list = (inputs[f.key] as string[]) ?? []
                        const on = list.includes(o)
                        const full = !on && f.max != null && list.length >= f.max
                        return (
                          <button
                            key={o}
                            type="button"
                            aria-pressed={on}
                            disabled={full}
                            onClick={() => setField(f.key, on ? list.filter(x => x !== o) : [...list, o])}
                            className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                              on
                                ? 'bg-brand-primary/20 text-white ring-1 ring-brand-primary'
                                : 'bg-white/[0.05] text-[#9A9DA5] ring-1 ring-white/[0.08] hover:text-white disabled:opacity-40'
                            }`}
                          >
                            {o}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </section>
              ))}

              <section className="space-y-3 rounded-[12px] bg-white/[0.03] p-3 ring-1 ring-white/[0.05]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] text-[#9A9DA5]">Length</span>
                  <Segmented
                    label="Length"
                    value={length}
                    options={type.lengths.map(l => ({ value: l, label: `${l}s` }))}
                    onChange={v => {
                      setLength(v)
                      setPlan(null)
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] text-[#9A9DA5]">Captions</span>
                  <Segmented
                    label="Captions"
                    value={captions}
                    options={(['off', 'serif', 'sans'] as CaptionChoice[]).map(c => ({ value: c, label: CAPTION_LABELS[c] }))}
                    onChange={setCaptions}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] text-[#9A9DA5]">Posts to</span>
                  <span className="text-[12.5px] text-[#E6E7EA]">
                    {format.label} · {format.aspectRatio}{' '}
                    <Link href={contentPostingModeHref('video')} className="ml-1 text-[#7FB0FF] hover:text-white">
                      Change
                    </Link>
                  </span>
                </div>
              </section>

              {plan && (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[12px] font-medium text-[#9A9DA5]">Plan{plan.title ? ` · ${plan.title}` : ''}</p>
                    <button
                      type="button"
                      onClick={makePlan}
                      disabled={loading}
                      className="inline-flex items-center gap-1 text-[12px] text-[#7FB0FF] hover:text-white disabled:opacity-50"
                    >
                      <RotateCcw size={12} /> Redo
                    </button>
                  </div>
                  <ol className="space-y-2">
                    {plan.beats.map((b, i) => (
                      <li key={i} className="rounded-[10px] bg-[#0F1012] p-2.5 ring-1 ring-white/[0.06]">
                        <textarea
                          aria-label={`Line ${i + 1}`}
                          value={b.text}
                          onChange={e =>
                            setPlan(p =>
                              p ? { ...p, beats: p.beats.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) } : p,
                            )
                          }
                          rows={2}
                          className="w-full resize-none bg-transparent text-[13.5px] leading-snug text-white outline-none"
                        />
                        {b.visual && <p className="mt-1 text-[11.5px] text-[#6B6E76]">On screen: {b.visual}</p>}
                      </li>
                    ))}
                  </ol>
                  {(() => {
                    const words = plan.beats.map(b => b.text).join(' ').split(/\s+/).filter(Boolean).length
                    const max = Math.floor(length * 3.2)
                    const over = canCreate && words > max
                    return (
                      <p className={`mt-2 text-[12px] ${over ? 'text-[#FF8A8A]' : 'text-[#6B6E76]'}`}>
                        {words} words · {over ? `too long for ${length}s — shorten a line (max ${max})` : `fits ${length}s`}
                      </p>
                    )
                  })()}
                  {plan.endCard && (
                    <p className="mt-2 text-[12px] text-[#9A9DA5]">
                      End card: <span className="text-[#E6E7EA]">{plan.endCard}</span> with your logo
                    </p>
                  )}
                  {plan.notes.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {plan.notes.map((n, i) => (
                        <li key={i} className="text-[12px] text-[#F5C26B]">
                          Check: {n}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>

            <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
              <div className="mb-3 flex items-center justify-center gap-4 text-[12.5px] text-[#9A9DA5]">
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={13} /> ~{type.minutes} min
                </span>
                <span className="h-3 w-px bg-white/10" />
                <span>{type.tag}</span>
                <span className="h-3 w-px bg-white/10" />
                <span>{length}s</span>
              </div>

              {error && <p className="mb-2 text-center text-[12.5px] text-[#FF8A8A]">{error}</p>}

              {!plan ? (
                <>
                  <button
                    type="button"
                    onClick={makePlan}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-brand-primary py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#1D62D6] disabled:opacity-70"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {loading ? 'Writing the plan…' : 'Make plan · free'}
                  </button>
                  <p className="mt-2 text-center text-[11.5px] text-[#6B6E76]">{type.planPreview}</p>
                </>
              ) : (
                <>
                  {job ? (
                    <div className="rounded-[12px] bg-white/[0.04] p-3 ring-1 ring-white/[0.06]">
                      {(['starting', 'rendering', 'editing', 'completed'] as const).map((st, i) => {
                        const order = ['starting', 'rendering', 'editing', 'completed']
                        const now = order.indexOf(job.status)
                        const done = job.status !== 'failed' && i < now
                        const active = job.status === st && st !== 'completed'
                        const label = ['Voice in ' + (creator?.name ?? 'the creator') + '\u2019s voice', 'Recording the video (about 8 min)', 'Captions and end card', 'In Approvals'][i]
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
                      {job.status === 'failed' && (
                        <p className="mt-2 text-[12.5px] text-[#FF8A8A]">The video failed. Your credits were refunded automatically.</p>
                      )}
                      {job.status === 'completed' ? (
                        <a href="/dashboard/agents/approvals" className="mt-3 block rounded-[10px] bg-brand-primary py-2.5 text-center text-[14px] font-semibold text-white hover:bg-[#1D62D6]">
                          Open Approvals
                        </a>
                      ) : job.status !== 'failed' ? (
                        <p className="mt-2 text-[11.5px] text-[#6B6E76]">You can close this — the video keeps going and lands in Approvals.</p>
                      ) : null}
                    </div>
                  ) : canCreate ? (
                    <>
                      <button
                        type="button"
                        onClick={approveAndCreate}
                        disabled={!creator || plan.beats.map(b => b.text).join(' ').split(/\s+/).filter(Boolean).length > Math.floor(length * 3.2)}
                        className="w-full rounded-[12px] bg-brand-primary py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#1D62D6] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-[#8A8D95]"
                      >
                        Approve &amp; create · {creditsFor} credits
                      </button>
                      <p className="mt-2 text-center text-[11.5px] leading-snug text-[#6B6E76]">
                        {creator ? 'Charged once. If the video fails, the credits come back automatically.' : 'Choose a creator first.'}
                      </p>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled
                        className="w-full cursor-not-allowed rounded-[12px] bg-white/[0.08] py-3.5 text-[15px] font-semibold text-[#8A8D95]"
                      >
                        Approve &amp; create
                      </button>
                      <p className="mt-2 text-center text-[11.5px] leading-snug text-[#6B6E76]">
                        Making this video type is coming soon. Plans are always free.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <CreatorsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selectedId={creator?.id ?? null}
        onPick={c => {
          setCreator(c)
          saveCreator(c)
        }}
      />
    </div>
  )
}
