import type { ProductShot } from './productCut'

/**
 * Signature product ad (option 3) as a fixed edit template.
 *
 * Source: the owner's hand cut in DaVinci Resolve ("Product 2", Being Frens, 2026-10-30), read clip by
 * clip from his timeline (V3 + V4/V5 overlays): 33 shots, 239 frames at 24fps (9.96s). Grammar: an
 * opening burst (9 shots in 1.17s), breaths (a 1.375s focus-pull reveal, a 1.458s texture hold), motifs
 * that come back, and a closing burst. Owner verdicts: his edit "closer to what I had in mind"; the same
 * structure filled with a second product (Barefaced) "looks cool"; re-scored with a different sound "works
 * as well" -> the cut is fixed, the soundtrack is a separate choice.
 *
 * Each slot names a ROLE (what kind of picture goes there) and a TAKE (which moment of that role).
 * Same role + same take = the exact same frames again (the motif repeats in his edit are deliberate).
 */
export type SignatureRole =
  | 'hero'          // label shot of the main product (approved still or locked-off clip)
  | 'hero2'         // label shot of the second product / second angle
  | 'group'         // all products together
  | 'angle'         // product at an angle (tilted, leaning)
  | 'lifestyle'     // styled flat lay / scene
  | 'textureStill'  // macro of the texture (swirl, drop), near-static
  | 'textureMotion' // texture being worked (spatula spread, swipe)
  | 'frost'         // glimpse of the hero behind frost / fog
  | 'reveal'        // the slow focus-pull reveal of the hero (the breath)
  | 'pour'          // product coming out (squeeze, pour, drip): live motion
  | 'apply'         // product applied / smeared on the pack or skin
  | 'stopmotion'    // keyframe stills (stop-motion steps)

export type SignatureSlot = {
  frames: number // at 24fps
  role: SignatureRole
  take: number
  /** Clicks only in the bursts (owner edit: 11 clicks in the first 1.2s, quiet middle, burst at the end). */
  click: boolean
  move?: 'drift' | 'crash' | 'frosted' | 'focusPull'
}

const B = true, Q = false
/** The owner's edit, slot by slot. Comments: what was in that slot in his Being Frens cut. */
export const SIGNATURE_SLOTS: SignatureSlot[] = [
  // Opening burst: 9 shots, 28 frames
  { frames: 3, role: 'textureStill', take: 0, click: B },                 // lotion swirl + spatula
  { frames: 3, role: 'group', take: 0, click: B },                        // tube + bottle
  { frames: 2, role: 'hero', take: 0, click: B },                         // bottle on plinth
  { frames: 2, role: 'textureStill', take: 1, click: B },                 // swirl, other moment
  { frames: 5, role: 'angle', take: 0, click: B },                        // tube leaning
  { frames: 3, role: 'textureStill', take: 0, click: B },                 // swirl again (motif)
  { frames: 6, role: 'textureMotion', take: 0, click: B },                // knife spreading
  { frames: 3, role: 'hero2', take: 0, click: B },                        // tube on plinth
  { frames: 1, role: 'hero', take: 1, click: B },                         // bottle, 1 frame
  // Into the creative set
  { frames: 2, role: 'lifestyle', take: 0, click: B },                    // flat lay
  { frames: 4, role: 'frost', take: 0, click: B, move: 'frosted' },       // bottle behind frost
  { frames: 7, role: 'frost', take: 1, click: B, move: 'frosted' },       // white fog
  { frames: 4, role: 'pour', take: 0, click: Q },                         // squeeze
  { frames: 11, role: 'apply', take: 0, click: Q, move: 'drift' },        // smear on tube
  { frames: 13, role: 'hero', take: 2, click: Q, move: 'drift' },         // bottle hero
  // Breath 1: the reveal
  { frames: 33, role: 'reveal', take: 0, click: Q, move: 'focusPull' },   // warm bottle, focus pull
  { frames: 6, role: 'frost', take: 2, click: Q, move: 'frosted' },
  { frames: 4, role: 'pour', take: 0, click: Q },
  { frames: 19, role: 'stopmotion', take: 0, click: Q },                  // smeared tube (keyframe)
  { frames: 9, role: 'hero', take: 3, click: Q, move: 'drift' },
  { frames: 4, role: 'pour', take: 0, click: Q },
  // Breath 2: the texture hold
  { frames: 35, role: 'pour', take: 1, click: Q, move: 'drift' },
  { frames: 5, role: 'apply', take: 1, click: Q },
  // Closing burst: motifs come back
  { frames: 5, role: 'angle', take: 0, click: B },
  { frames: 3, role: 'textureStill', take: 0, click: B },
  { frames: 6, role: 'textureMotion', take: 0, click: B },
  { frames: 6, role: 'textureMotion', take: 0, click: B },
  { frames: 3, role: 'hero2', take: 0, click: B },
  { frames: 1, role: 'apply', take: 1, click: B },
  { frames: 11, role: 'stopmotion', take: 1, click: B },                  // smeared tube
  { frames: 8, role: 'stopmotion', take: 2, click: B },                   // clean tube
  { frames: 8, role: 'hero', take: 4, click: B, move: 'crash' },          // inferred: the crash zoom lives here
  { frames: 4, role: 'lifestyle', take: 1, click: B },                    // flat lay, end frame
]

export const SIGNATURE_FRAMES = SIGNATURE_SLOTS.reduce((a, s) => a + s.frames, 0) // 239

/** When a product has no asset for a role, use the next role that exists. */
const FALLBACK: Record<SignatureRole, SignatureRole[]> = {
  hero: ['hero2', 'group', 'angle'],
  hero2: ['hero', 'angle', 'group'],
  group: ['hero', 'hero2'],
  angle: ['hero2', 'hero'],
  lifestyle: ['group', 'hero'],
  textureStill: ['textureMotion', 'pour', 'apply'],
  textureMotion: ['pour', 'apply', 'textureStill'],
  frost: ['reveal', 'hero'],
  reveal: ['hero', 'hero2'],
  pour: ['textureMotion', 'apply', 'textureStill'],
  apply: ['pour', 'textureMotion', 'textureStill'],
  stopmotion: ['apply', 'hero2', 'hero'],
}

export type SignatureAsset<R> = {
  ref: R
  kind: 'video' | 'image'
  /** Clip length in seconds (videos). */
  duration?: number
  /** Explicit in-points (seconds) for this asset's takes. Otherwise spread over the clip. */
  takes?: number[]
  /**
   * The asset already carries its move (e.g. an edited render with the zoom or frost baked in, as in the
   * owner's cut). Then the template adds no zoom/frost of its own.
   */
  baked?: boolean
  /** A wet-glass clip (frost role): the reveal holds on it, then hard cuts to the sharp hero. */
  wetGlass?: boolean
}
export type SignatureAssets<R> = Partial<Record<SignatureRole, SignatureAsset<R> | SignatureAsset<R>[]>>

export type SignaturePlanShot<R> = Omit<ProductShot, 'video' | 'image' | 'layers'> & { ref: R; kind: 'video' | 'image'; role: SignatureRole; click: boolean }

/** Image-to-video clips start from a frozen still: don't take moments from the first 0.6s. */
const MIN_IN = 0.6

/** Fill the template with one product's assets. Returns shots in edit order (refs, not buffers). */
export function planSignature<R>(assets: SignatureAssets<R>): SignaturePlanShot<R>[] {
  const lists = new Map<SignatureRole, SignatureAsset<R>[]>()
  for (const [k, v] of Object.entries(assets) as Array<[SignatureRole, SignatureAsset<R> | SignatureAsset<R>[] | undefined]>) {
    const arr = v ? (Array.isArray(v) ? v : [v]) : []
    if (arr.length) lists.set(k, arr)
  }
  if (!lists.size) throw new Error('signature: no assets')
  const resolve = (role: SignatureRole): [SignatureRole, SignatureAsset<R>[]] => {
    for (const r of [role, ...FALLBACK[role]]) { const l = lists.get(r); if (l) return [r, l] }
    const [r, l] = [...lists.entries()][0]!
    return [r, l]
  }
  // How many distinct takes the template asks of each role (to spread auto in-points).
  const takesWanted = new Map<SignatureRole, number>()
  for (const s of SIGNATURE_SLOTS) takesWanted.set(s.role, Math.max(takesWanted.get(s.role) ?? 0, s.take + 1))

  const shots = SIGNATURE_SLOTS.map((slot): SignaturePlanShot<R> => {
    const len = slot.frames / 24
    const [role, list] = resolve(slot.role)
    // Moments: every explicit take of every asset, in order; assets without takes count once per wanted take.
    const want = takesWanted.get(slot.role) ?? 1
    const moments: Array<{ a: SignatureAsset<R>; t: number | null; k: number; n: number }> = []
    for (const a of list) {
      if (a.takes?.length) for (const t of a.takes) moments.push({ a, t, k: 0, n: 1 })
      else {
        const n = a.kind === 'video' ? Math.max(1, Math.ceil(want / list.length)) : 1
        for (let k = 0; k < n; k++) moments.push({ a, t: null, k, n })
      }
    }
    const m = moments[slot.take % moments.length]!
    let from = 0
    if (m.a.kind === 'video') {
      const dur = m.a.duration ?? 5
      if (m.t != null) from = m.t
      else {
        const lo = Math.min(MIN_IN, Math.max(0, dur - len))
        const hi = Math.max(lo, dur - len - 0.05)
        from = m.n > 1 ? lo + ((hi - lo) * m.k) / (m.n - 1) : lo + (hi - lo) * 0.35
      }
      from = Math.max(0, Math.min(from, dur - len))
    }
    const shot: SignaturePlanShot<R> = { ref: m.a.ref, kind: m.a.kind, role, click: slot.click, from: Number(from.toFixed(4)), to: Number((from + len).toFixed(4)) }
    if (!m.a.baked) {
      if (slot.move === 'drift') { shot.zoom = 0.12; shot.zoomSec = len }
      else if (slot.move === 'crash') { shot.zoom = 1; shot.zoomSec = Math.min(0.25, len) }
      else if (slot.move === 'frosted') { shot.frostHold = len; shot.frostSec = 0.04 }
      else if (slot.move === 'focusPull') { shot.frostFog = false; shot.frostHold = 0.2; shot.frostSec = Math.max(0.3, len - 0.45) }
    }
    return shot
  })
  return applyWetGlassReveal(shots, lists)
}

/**
 * Owner 2026-11-02: when the product has a wet-glass clip (role `frost`: the product behind a pane of
 * glass with water running down, made from the approved still with first+last frame locked), the
 * reveal breath holds on it so the drips can be seen, then HARD CUTS to the sharp hero (he picked the
 * hard cut over a 0.3s dissolve). 33 frames -> 22 frames wet glass + 11 frames sharp hero.
 */
function applyWetGlassReveal<R>(shots: SignaturePlanShot<R>[], lists: Map<SignatureRole, SignatureAsset<R>[]>): SignaturePlanShot<R>[] {
  const wet = lists.get('frost')?.find(a => a.kind === 'video' && a.wetGlass)
  const hero = lists.get('hero')?.[0] ?? lists.get('hero2')?.[0]
  const i = SIGNATURE_SLOTS.findIndex(s => s.role === 'reveal')
  if (!wet || !hero || i < 0) return shots
  const total = SIGNATURE_SLOTS[i]!.frames
  const wetF = Math.round(total * 2 / 3)
  const dur = wet.duration ?? 3
  const wetLen = wetF / 24
  const from = Math.max(0, Math.min(0.9, dur - wetLen))
  const heroLen = (total - wetF) / 24
  const heroFrom = hero.kind === 'video' ? Math.min(MIN_IN, Math.max(0, (hero.duration ?? 5) - heroLen)) : 0
  const out = shots.slice()
  out.splice(i, 1,
    { ref: wet.ref, kind: 'video', role: 'frost', click: false, from: Number(from.toFixed(4)), to: Number((from + wetLen).toFixed(4)) },
    { ref: hero.ref, kind: hero.kind, role: 'hero', click: false, from: heroFrom, to: Number((heroFrom + heroLen).toFixed(4)) },
  )
  return out
}
