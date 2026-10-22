'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Loader2, Plus, X } from 'lucide-react'
import {
  CREATOR_TRAITS,
  DEFAULT_CREATOR_TRAITS,
  type CreatorTraits,
} from '@/lib/agents/contentPosting/creators'
import { fieldClass } from './ui'

export type PickedCreator = { id: string; kind: 'cast' | 'mine'; name: string; photoUrl: string | null }

type CastItem = { id: string; name: string; gender: string; age: number; look: string; photoUrl: string | null }
type MineItem = { id: string; name: string; photoUrl: string | null; createdAt: string }
type Library = { cast: CastItem[]; mine: MineItem[]; saveCredits: number }

let cache: { at: number; lib: Library } | null = null

export async function loadLibrary(force = false): Promise<Library> {
  if (!force && cache && Date.now() - cache.at < 50 * 60_000) return cache.lib
  const res = await fetch('/api/posts/creators')
  if (!res.ok) throw new Error('Could not load creators.')
  const lib = (await res.json()) as Library
  cache = { at: Date.now(), lib }
  return lib
}

const TRAIT_LABELS: Record<keyof CreatorTraits, string> = {
  gender: 'Creator',
  age: 'Age',
  skin: 'Skin tone',
  hair: 'Hair',
  wear: 'Wears',
  room: 'Room',
}

function CreatorCard({
  name,
  photoUrl,
  sub,
  selected,
  onClick,
}: {
  name: string
  photoUrl: string | null
  sub?: string
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group relative aspect-[2/3] w-full overflow-hidden rounded-[12px] bg-[#1C1D21] text-left transition-all ${
        selected ? 'ring-2 ring-brand-primary' : 'ring-1 ring-white/[0.06] hover:ring-white/25'
      }`}
    >
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-8">
        <p className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-white">{name}</p>
        {sub && <p className="mt-0.5 line-clamp-1 text-[11px] text-white/70 opacity-0 transition-opacity group-hover:opacity-100">{sub}</p>}
      </div>
      {selected && (
        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-white">
          <Check size={14} strokeWidth={2.6} />
        </span>
      )}
    </button>
  )
}

/**
 * Creators: our cast of 12 plus the workspace's own. In "pick" mode, choosing a card returns it.
 * "Create your own": pick traits → 2 photo options (free) → keep one, name it → saved (charged once).
 */
export default function CreatorsSheet({
  open,
  onClose,
  onPick,
  selectedId,
}: {
  open: boolean
  onClose: () => void
  onPick?: (c: PickedCreator) => void
  selectedId?: string | null
}) {
  const [lib, setLib] = useState<Library | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<'cast' | 'mine'>('cast')
  const [creating, setCreating] = useState(false)

  const [traits, setTraits] = useState<CreatorTraits>(DEFAULT_CREATOR_TRAITS)
  const [options, setOptions] = useState<Array<{ photoPath: string; photoUrl: string | null }>>([])
  const [chosen, setChosen] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<'options' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    loadLibrary()
      .then(setLib)
      .catch(e => setLoadError(e instanceof Error ? e.message : 'Could not load creators.'))
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (creating) setCreating(false)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, creating, onClose])

  if (!open) return null

  function pick(c: PickedCreator) {
    onPick?.(c)
    onClose()
  }

  async function makeOptions() {
    setBusy('options')
    setError(null)
    setOptions([])
    setChosen(null)
    try {
      const res = await fetch('/api/posts/creators/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traits }),
      })
      const data = (await res.json().catch(() => ({}))) as { options?: typeof options; message?: string }
      if (!res.ok || !data.options?.length) throw new Error(data.message ?? 'Maya could not make the photos. Try again.')
      setOptions(data.options)
      setChosen(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Maya could not make the photos. Try again.')
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    if (chosen === null || !options[chosen]) return
    if (!name.trim()) {
      setError('Give your creator a name.')
      return
    }
    setBusy('save')
    setError(null)
    try {
      const res = await fetch('/api/posts/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), traits, photoPath: options[chosen]!.photoPath }),
      })
      const data = (await res.json().catch(() => ({}))) as { creator?: MineItem; message?: string }
      if (!res.ok || !data.creator) throw new Error(data.message ?? 'Could not save the creator.')
      const fresh = await loadLibrary(true).catch(() => null)
      if (fresh) setLib(fresh)
      setCreating(false)
      setOptions([])
      setName('')
      setTab('mine')
      if (onPick) pick({ id: data.creator.id, kind: 'mine', name: data.creator.name, photoUrl: data.creator.photoUrl })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the creator.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Creators">
      <div className="flex max-h-full w-full max-w-[980px] flex-col overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#151619] text-[#F2F3F5]">
        <div className="flex items-start gap-3 border-b border-white/[0.06] px-5 py-4">
          {creating && (
            <button
              type="button"
              onClick={() => setCreating(false)}
              aria-label="Back to creators"
              className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-[#C9CBD1] hover:bg-white/[0.14] hover:text-white"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold text-white">{creating ? 'Create your own creator' : 'Creators'}</p>
            <p className="mt-0.5 text-[13px] text-[#9A9DA5]">
              {creating
                ? 'Pick the look. Maya makes two photos; keep the one you like and it is saved to your account.'
                : 'Every video with a creator uses the same face. Pick one of ours, or create your own.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-[#C9CBD1] hover:bg-white/[0.14] hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loadError && <p className="text-[13px] text-[#FF8A8A]">{loadError}</p>}

          {!creating && (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="inline-flex rounded-[10px] bg-white/[0.05] p-[3px] ring-1 ring-white/[0.06]" role="tablist">
                  {(['cast', 'mine'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={tab === t}
                      onClick={() => setTab(t)}
                      className={`rounded-[8px] px-3.5 py-1.5 text-[13px] font-medium ${tab === t ? 'bg-white/[0.14] text-white' : 'text-[#9A9DA5] hover:text-white'}`}
                    >
                      {t === 'cast' ? `Our creators${lib ? ` · ${lib.cast.length}` : ''}` : `Yours${lib ? ` · ${lib.mine.length}` : ''}`}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(true)
                    setError(null)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#1D62D6]"
                >
                  <Plus size={15} /> Create your own
                </button>
              </div>

              {!lib && !loadError && (
                <div className="flex items-center gap-2 py-10 text-[13px] text-[#9A9DA5]">
                  <Loader2 size={15} className="animate-spin" /> Loading creators…
                </div>
              )}

              {lib && tab === 'cast' && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {lib.cast.map(c => (
                    <CreatorCard
                      key={c.id}
                      name={c.name}
                      photoUrl={c.photoUrl}
                      sub={c.look}
                      selected={selectedId === c.id}
                      onClick={onPick ? () => pick({ id: c.id, kind: 'cast', name: c.name, photoUrl: c.photoUrl }) : undefined}
                    />
                  ))}
                </div>
              )}

              {lib && tab === 'mine' && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="flex aspect-[2/3] flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-white/[0.16] text-[13px] text-[#9A9DA5] hover:border-white/30 hover:text-white"
                  >
                    <Plus size={20} /> Create your own
                  </button>
                  {lib.mine.map(c => (
                    <CreatorCard
                      key={c.id}
                      name={c.name}
                      photoUrl={c.photoUrl}
                      selected={selectedId === c.id}
                      onClick={onPick ? () => pick({ id: c.id, kind: 'mine', name: c.name, photoUrl: c.photoUrl }) : undefined}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {creating && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                {(Object.keys(CREATOR_TRAITS) as (keyof CreatorTraits)[]).map(k => (
                  <div key={k}>
                    <p className="mb-2 text-[12px] font-medium text-[#9A9DA5]">{TRAIT_LABELS[k]}</p>
                    <div className="flex flex-wrap gap-2">
                      {(CREATOR_TRAITS[k] as readonly string[]).map(o => {
                        const on = traits[k] === o
                        return (
                          <button
                            key={o}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setTraits(t => ({ ...t, [k]: o }))}
                            className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                              on
                                ? 'bg-brand-primary/20 text-white ring-1 ring-brand-primary'
                                : 'bg-white/[0.05] text-[#9A9DA5] ring-1 ring-white/[0.08] hover:text-white'
                            }`}
                          >
                            {o}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={makeOptions}
                  disabled={busy !== null}
                  className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-brand-primary py-3 text-[14.5px] font-semibold text-white hover:bg-[#1D62D6] disabled:opacity-60"
                >
                  {busy === 'options' && <Loader2 size={16} className="animate-spin" />}
                  {busy === 'options' ? 'Making two photos…' : options.length ? 'Make two new photos · free' : 'Make two photos · free'}
                </button>
              </div>

              <div>
                {options.length === 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1].map(i => (
                      <div key={i} className="flex aspect-[2/3] items-center justify-center rounded-[12px] border border-dashed border-white/[0.1] text-[12px] text-[#5C5F67]">
                        {busy === 'options' ? <Loader2 size={18} className="animate-spin" /> : `Photo ${i + 1}`}
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {options.map((o, i) => (
                        <CreatorCard key={o.photoPath} name={`Photo ${i + 1}`} photoUrl={o.photoUrl} selected={chosen === i} onClick={() => setChosen(i)} />
                      ))}
                    </div>
                    <label htmlFor="creator-name" className="mb-2 mt-4 block text-[12px] font-medium text-[#9A9DA5]">
                      Name
                    </label>
                    <input
                      id="creator-name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Sam"
                      maxLength={40}
                      className={fieldClass}
                    />
                    <button
                      type="button"
                      onClick={save}
                      disabled={busy !== null || chosen === null}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] bg-white py-3 text-[14.5px] font-semibold text-[#0E0F11] hover:bg-white/90 disabled:opacity-60"
                    >
                      {busy === 'save' && <Loader2 size={16} className="animate-spin" />}
                      Save creator{lib ? ` · ${lib.saveCredits} credits` : ''}
                    </button>
                  </>
                )}
                {error && <p className="mt-3 text-[12.5px] text-[#FF8A8A]">{error}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
