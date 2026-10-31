import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fontPath, must, wrapWords } from './assemble'

/**
 * Product ad edit (no voice, no presenter): a fast sequence of shots cut from image-to-video clips.
 * Reference: the Philip B. reel (cuts every 0.5-1.5s, real packaging, no voice). Each 5s clip usually
 * gives two shots (its start and its end look different after the camera move), so 6 clips make ~12
 * cuts. Image-to-video starts from a frozen still, so shots should start at 0.6s or later.
 * Output is silent (a silent stereo track is kept for platform compatibility): owner 2026-10-30, users
 * download and add a sound in Instagram or TikTok.
 */
export type ProductShot = {
  /** A clip, cut from `from` to `to` seconds. */
  video?: Buffer
  /**
   * Or a still image held for (to - from) seconds, usually with `zoom`. Owner 2026-10-30: model motion
   * on label shots kept going wrong (product rocking, mist spraying with the cap on, a stray shadow of a
   * person), so label hero shots can be the approved still plus a smooth zoom: no motion model, no drift.
   */
  image?: Buffer
  from: number
  to: number
  /**
   * Optional zoom done in the edit (not by the video model). Owner 2026-10-30: the model's camera
   * push-ins look shaky; wanted "a fast smooth zoom". So clips are filmed with a locked-off camera and
   * the zoom is added here: scale up by `zoom` (0.15 = 15%) with an ease-out over `zoomSec` (default
   * 0.8s), then hold. Frames are upscaled 2x first so the crop moves in half-pixel steps (no stepping).
   */
  zoom?: number
  zoomSec?: number
  /**
   * How this shot enters from the previous one. Default: the cut-wide setting (hard cut, or the
   * crossfade). Slides/pushes are for the creative route (owner reference 2026-10-30: Cyklar reel ends
   * by pushing back to the opening shot). Any ffmpeg xfade transition name works.
   */
  transition?: ProductTransition
  transitionSec?: number
  /**
   * Signature route (owner reference: Cyklar reel, 2026-10-30): the edit mixes live motion with
   * stop-motion. `step` plays the shot at that many frames per second, each frame held (4-6 = stop
   * motion), and every step gets a click when clicks are on. Omit for live motion.
   */
  step?: number
  /** Freeze the first frame for this many seconds before the motion starts ("hold, then move"). */
  hold?: number
  /**
   * Frost-to-sharp reveal on the real frame: starts blurred and fogged, holds `frostHold` seconds, then
   * clears over `frostSec`. Replaces model-made reveals, which invent the label (2026-10-30 glass test).
   */
  frostSec?: number
  frostHold?: number
  /**
   * Stop-motion build-up: a background with cut-out items (PNG with transparency, e.g. the user's own
   * product photos with the background removed, and props) that land one by one at `at` seconds into
   * the shot. x/y = item centre and w = item width, as fractions of the frame; angle in degrees. Each
   * item gets a soft drop shadow, and a click when clicks are on.
   */
  layers?: { background: Buffer; items: Array<{ image: Buffer; x: number; y: number; w: number; angle?: number; at: number }> }
}

export type ProductTransition =
  | 'cut' | 'fade' | 'slideup' | 'slidedown' | 'slideleft' | 'slideright'
  | 'smoothup' | 'smoothdown' | 'smoothleft' | 'smoothright' | 'zoomin' | 'fadewhite' | 'flash'
export type ProductText = { text: string; start: number; end: number }
const TRANSITIONS = new Set<ProductTransition>(['cut', 'fade', 'slideup', 'slidedown', 'slideleft', 'slideright', 'smoothup', 'smoothdown', 'smoothleft', 'smoothright', 'zoomin', 'fadewhite', 'flash'])

export type ProductCutInput = {
  shots: ProductShot[]
  /** Optional on-screen text, on the output timeline (seconds). Off unless the user turns it on. */
  texts?: ProductText[]
  /** 0 = hard cuts (default, like the reference). >0 = crossfade seconds between shots. */
  crossfade?: number
  /**
   * Creative route: end by pushing back to the opening frame so the video loops seamlessly when the
   * platform replays it. Adds the first `loopSec` (default 0.6s) of shot 1 at the end, entering with
   * `loopTransition` (default: hard cut; owner 2026-10-30: no slide transitions).
   */
  loop?: boolean
  loopSec?: number
  loopTransition?: ProductTransition
  /**
   * Click sounds on the cuts, on every stop-motion step and on every item landing (Signature route).
   * Generated in ffmpeg (no sample file, no licence). Off = silent track; users add music in the app.
   */
  clicks?: boolean
  width?: number
  height?: number
}

export async function assembleProductCut(input: ProductCutInput): Promise<{ video: Buffer; durationSec: number }> {
  const shots = input.shots.filter(s => s.to - s.from >= 0.2)
  if (!shots.length) throw new Error('no shots')
  if (input.loop) {
    const first = shots[0]!
    const len = Math.max(0.4, input.loopSec ?? 0.6)
    // Same frames as the opening (zoom restarts from 1x, so the last frame matches the first).
    shots.push({ ...first, to: first.from + len, zoom: 0, transition: input.loopTransition ?? 'cut', transitionSec: 0.35 })
  }
  const W = input.width ?? 1080
  const H = input.height ?? 1920
  const cf = Math.max(0, Math.min(0.4, input.crossfade ?? 0))
  const dir = await mkdtemp(path.join(tmpdir(), 'pcut-'))
  try {
    const args = ['-hide_banner', '-y']
    const filters: string[] = []
    const durs: number[] = []
    let inputs = 0
    const addInput = (...a: string[]) => { args.push(...a); return inputs++ }
    const fit = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`
    const shotClicks: number[][] = []
    for (const [i, s] of shots.entries()) {
      const d = s.to - s.from
      const hold = Math.max(0, Math.min(3, s.hold ?? 0))
      durs.push(d + hold)
      const clicksHere: number[] = []
      let src: string
      if (s.layers) {
        const bg = path.join(dir, `s${i}bg.img`)
        await writeFile(bg, s.layers.background)
        const bi = addInput('-loop', '1', '-framerate', '30', '-t', d.toFixed(3), '-i', bg)
        filters.push(`[${bi}:v]${fit},format=rgba[L${i}]`)
        let cur = `[L${i}]`
        for (const [k, it] of s.layers.items.entries()) {
          const f = path.join(dir, `s${i}i${k}.png`)
          await writeFile(f, it.image)
          const ii = addInput('-loop', '1', '-framerate', '30', '-t', d.toFixed(3), '-i', f)
          const w = Math.max(16, Math.round(it.w * W))
          const ang = ((it.angle ?? 0) * Math.PI) / 180
          const at = Math.max(0, it.at).toFixed(3)
          const cx = Math.round(it.x * W)
          const cy = Math.round(it.y * H)
          filters.push(`[${ii}:v]format=rgba,scale=${w}:-2,rotate=${ang.toFixed(4)}:c=none:ow=rotw(${ang.toFixed(4)}):oh=roth(${ang.toFixed(4)}),split[it${i}_${k}][sh${i}_${k}]`)
          filters.push(`[sh${i}_${k}]colorchannelmixer=rr=0:gg=0:bb=0:aa=0.32,boxblur=12:2[sb${i}_${k}]`)
          filters.push(`${cur}[sb${i}_${k}]overlay=x=${cx}-w/2+${Math.round(W * 0.012)}:y=${cy}-h/2+${Math.round(H * 0.01)}:enable='gte(t,${at})'[os${i}_${k}]`)
          filters.push(`[os${i}_${k}][it${i}_${k}]overlay=x=${cx}-w/2:y=${cy}-h/2:enable='gte(t,${at})'[o${i}_${k}]`)
          cur = `[o${i}_${k}]`
          clicksHere.push(Math.max(0, it.at) + hold)
        }
        src = cur
      } else if (s.image) {
        const f = path.join(dir, `s${i}.img`)
        await writeFile(f, s.image)
        src = `[${addInput('-loop', '1', '-framerate', '30', '-t', d.toFixed(3), '-i', f)}:v]`
      } else if (s.video) {
        const f = path.join(dir, `s${i}.mp4`)
        await writeFile(f, s.video)
        src = `[${addInput('-ss', s.from.toFixed(3), '-t', d.toFixed(3), '-i', f)}:v]`
      } else {
        throw new Error(`shot ${i} has no video, image or layers`)
      }
      const step = s.step && s.step > 0 && s.step < 30 ? Math.round(s.step) : 0
      if (step) for (let t = 0; t < d - 0.05; t += 1 / step) clicksHere.push(hold + t)
      const holdF = hold > 0 ? `,loop=loop=${Math.round(hold * 30)}:size=1:start=0` : ''
      const z = Math.max(0, Math.min(0.5, s.zoom ?? 0))
      const frames = Math.max(1, Math.round((s.zoomSec ?? 0.8) * 30))
      const zoom = z > 0
        ? `,scale=${W * 2}:${H * 2}:flags=lanczos,zoompan=z='1+${z.toFixed(3)}*(1-pow(1-min(1\\,on/${frames})\\,3))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=30`
        : ''
      const base = `${src}${fit},fps=30${step ? `,fps=${step},fps=30` : ''}${holdF},setpts=N/30/TB${zoom},format=yuv420p,setpts=N/30/TB,settb=AVTB`
      if (s.frostSec && s.frostSec > 0) {
        const fh = Math.max(0, s.frostHold ?? 0.3)
        filters.push(`${base},split[fa${i}][fz${i}]`)
        filters.push(`[fz${i}]boxblur=26:3,lutyuv=y='val*0.5+118':u='(val-128)*0.5+128':v='(val-128)*0.5+128',format=yuva420p,fade=t=out:st=${fh.toFixed(3)}:d=${s.frostSec.toFixed(3)}:alpha=1[fc${i}]`)
        filters.push(`[fa${i}][fc${i}]overlay=eof_action=pass,format=yuv420p,setpts=N/30/TB,settb=AVTB[v${i}]`)
      } else {
        filters.push(`${base}[v${i}]`)
      }
      shotClicks.push(clicksHere)
    }
    // Join shots. The server's ffmpeg (@ffmpeg-installer, 4.1) has no xfade (2026-10-30: "No such
    // filter: 'xfade'"), so transitions are built from 4.1 filters: each transition becomes its own short
    // segment (tail of the previous shot + head of the next, composited with overlay/fade), and every
    // piece is joined with one concat. Total length = shots minus overlaps, same as a crossfade.
    const n = shots.length
    const kinds: ProductTransition[] = shots.map((sh, i) => {
      if (i === 0) return 'cut'
      const asked = sh.transition
      return asked && TRANSITIONS.has(asked) ? asked : cf > 0 ? 'fade' : 'cut'
    })
    const tlen: number[] = shots.map((sh, i) => {
      if (i === 0 || kinds[i] === 'cut') return 0
      const want = sh.transitionSec ?? (kinds[i] === 'fade' && cf > 0 ? cf : 0.3)
      return Math.max(0.1, Math.min(want, durs[i - 1]! * 0.45, durs[i]! * 0.45))
    })
    // How many times each shot is used: body, + tail if the next shot transitions in, + head if it transitions in.
    for (let i = 0; i < n; i++) {
      const outs = [`[b${i}]`]
      if (tlen[i]! > 0) outs.push(`[h${i}]`)
      if (i + 1 < n && tlen[i + 1]! > 0) outs.push(`[t${i}]`)
      if (outs.length === 1) filters.push(`[v${i}]null[b${i}raw]`)
      else filters.push(`[v${i}]split=${outs.length}${outs.map(o => o === `[b${i}]` ? `[b${i}raw]` : o.replace(']', 'raw]')).join('')}`)
      const head = tlen[i]!
      const tail = i + 1 < n ? tlen[i + 1]! : 0
      const trim = (from: number, to: number) => `trim=start=${from.toFixed(3)}:end=${to.toFixed(3)},setpts=PTS-STARTPTS,settb=AVTB`
      filters.push(`[b${i}raw]${trim(head, durs[i]! - tail)}[b${i}]`)
      if (head > 0) filters.push(`[h${i}raw]${trim(0, head)}[h${i}]`)
      if (tail > 0) filters.push(`[t${i}raw]${trim(durs[i]! - tail, durs[i]!)}[t${i}]`)
    }
    const segs: string[] = []
    let total = 0
    const clickTimes: number[] = []
    for (let i = 0; i < n; i++) {
      const T = tlen[i]!
      // Shot i is visible from `total` (start of its transition, or its cut).
      if (i > 0) clickTimes.push(total + T * 0.5)
      for (const c of shotClicks[i]!) clickTimes.push(total + c)
      if (T > 0) {
        const A = `[t${i - 1}]`
        const B = `[h${i}]`
        const out = `[x${i}]`
        const e = `(clip(t/${T.toFixed(3)},0,1)*clip(t/${T.toFixed(3)},0,1)*(3-2*clip(t/${T.toFixed(3)},0,1)))`
        const k = kinds[i]!
        const slide = /^(slide|smooth)(up|down|left|right)$/.exec(k)
        if (slide) {
          const dir = slide[2]!
          const canvas = `[cv${i}]`
          filters.push(`color=c=black:s=${W}x${H}:r=30:d=${T.toFixed(3)},format=yuv420p,settb=AVTB${canvas}`)
          const ax = dir === 'left' ? `-W*${e}` : dir === 'right' ? `W*${e}` : '0'
          const ay = dir === 'up' ? `-H*${e}` : dir === 'down' ? `H*${e}` : '0'
          const bx = dir === 'left' ? `W*(1-${e})` : dir === 'right' ? `-W*(1-${e})` : '0'
          const by = dir === 'up' ? `H*(1-${e})` : dir === 'down' ? `-H*(1-${e})` : '0'
          filters.push(`${canvas}${A}overlay=x='${ax}':y='${ay}':eof_action=pass[ca${i}]`)
          filters.push(`[ca${i}]${B}overlay=x='${bx}':y='${by}':eof_action=pass,format=yuv420p,settb=AVTB${out}`)
        } else if (k === 'flash') {
          // Overexposure flash: A blows out to white fast, B comes back from white slower.
          const outD = (T * 0.4).toFixed(3)
          filters.push(`${A}fade=t=out:st=0:d=${outD}:color=white[fa${i}]`)
          filters.push(`${B}fade=t=in:st=${outD}:d=${(T * 0.6).toFixed(3)}:color=white[fb${i}]`)
          filters.push(`[fa${i}][fb${i}]overlay=enable='gte(t,${outD})':eof_action=pass,format=yuv420p,settb=AVTB${out}`)
        } else if (k === 'fadewhite') {
          const half = (T / 2).toFixed(3)
          filters.push(`${A}fade=t=out:st=0:d=${half}:color=white[fa${i}]`)
          filters.push(`${B}fade=t=in:st=${half}:d=${half}:color=white[fb${i}]`)
          filters.push(`[fa${i}][fb${i}]overlay=enable='gte(t,${half})':eof_action=pass,format=yuv420p,settb=AVTB${out}`)
        } else {
          // fade (and zoomin, which 4.1 can't do cleanly): crossfade B over A.
          filters.push(`${B}format=yuva420p,fade=t=in:st=0:d=${T.toFixed(3)}:alpha=1[fb${i}]`)
          filters.push(`${A}[fb${i}]overlay=eof_action=pass,format=yuv420p,settb=AVTB${out}`)
        }
        segs.push(out)
        total += T
      }
      segs.push(`[b${i}]`)
      const tail = i + 1 < n ? tlen[i + 1]! : 0
      total += durs[i]! - tlen[i]! - tail
    }
    filters.push(`${segs.join('')}concat=n=${segs.length}:v=1:a=0[cat]`)
    let last = '[cat]'

    // Optional text: sans, centred, soft halo (same family as the Cinematic B-roll captions).
    const font = fontPath('sans').replace(/:/g, '\\:')
    const size = Math.round(H * 0.04)
    for (const [i, t] of (input.texts ?? []).entries()) {
      const lines = wrapWords(t.text, 20).slice(0, 2)
      for (const [j, line] of lines.entries()) {
        const tf = path.join(dir, `t${i}_${j}.txt`)
        await writeFile(tf, line)
        const out = `[t${i}_${j}]`
        const y = Math.round(H * 0.5 + (j - (lines.length - 1) / 2) * size * 1.25)
        filters.push(
          `${last}drawtext=fontfile='${font}':textfile='${tf}':fontcolor=white:fontsize=${size}:borderw=${Math.max(2, Math.round(H * 0.0022))}:bordercolor=black@0.35:shadowcolor=black@0.55:shadowx=0:shadowy=2:x=(w-text_w)/2:y=${y}-text_h/2:alpha='min(1,(t-${t.start.toFixed(2)})/0.2)':enable='between(t,${t.start.toFixed(2)},${t.end.toFixed(2)})'${out}`,
        )
        last = out
      }
    }

    const audioIdx = inputs
    // Clicks: one generated tick per time (short sine + noise burst, fast decay), summed in one aevalsrc.
    const ticks = input.clicks
      ? [...new Set(clickTimes.filter(t => t >= 0 && t < total - 0.02).map(t => Number(t.toFixed(3))))].sort((x, y) => x - y).slice(0, 120)
      : []
    if (ticks.length) {
      // if(): exp() before the tick time overflows to Inf, and 0*Inf = NaN (aac refuses NaN).
      const term = (t: number) => `if(between(t,${t},${(t + 0.04).toFixed(3)}),exp(-(t-${t})*380)*(0.5*sin(2*PI*2600*(t-${t}))+0.35*(2*random(0)-1)),0)`
      const expr = `0.6*(${ticks.map(term).join('+')})`
      args.push('-f', 'lavfi', '-i', `aevalsrc=exprs='${expr}|${expr}':s=44100:d=${total.toFixed(3)}`)
    } else {
      args.push('-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo')
    }
    const out = path.join(dir, 'out.mp4')
    args.push(
      '-filter_complex', filters.join(';'),
      '-map', last, '-map', `${audioIdx}:a`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30',
      '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out,
    )
    await must(args, 'product cut')
    return { video: await readFile(out), durationSec: total }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
