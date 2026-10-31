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
}

export type ProductTransition =
  | 'cut' | 'fade' | 'slideup' | 'slidedown' | 'slideleft' | 'slideright'
  | 'smoothup' | 'smoothdown' | 'smoothleft' | 'smoothright' | 'zoomin' | 'fadewhite'
export type ProductText = { text: string; start: number; end: number }
const TRANSITIONS = new Set<ProductTransition>(['cut', 'fade', 'slideup', 'slidedown', 'slideleft', 'slideright', 'smoothup', 'smoothdown', 'smoothleft', 'smoothright', 'zoomin', 'fadewhite'])

export type ProductCutInput = {
  shots: ProductShot[]
  /** Optional on-screen text, on the output timeline (seconds). Off unless the user turns it on. */
  texts?: ProductText[]
  /** 0 = hard cuts (default, like the reference). >0 = crossfade seconds between shots. */
  crossfade?: number
  /**
   * Creative route: end by pushing back to the opening frame so the video loops seamlessly when the
   * platform replays it. Adds the first `loopSec` (default 0.6s) of shot 1 at the end, entering with
   * `loopTransition` (default slideup).
   */
  loop?: boolean
  loopSec?: number
  loopTransition?: ProductTransition
  width?: number
  height?: number
}

export async function assembleProductCut(input: ProductCutInput): Promise<{ video: Buffer; durationSec: number }> {
  const shots = input.shots.filter(s => s.to - s.from >= 0.3)
  if (!shots.length) throw new Error('no shots')
  if (input.loop) {
    const first = shots[0]!
    const len = Math.max(0.4, input.loopSec ?? 0.6)
    // Same frames as the opening (zoom restarts from 1x, so the last frame matches the first).
    shots.push({ ...first, to: first.from + len, zoom: 0, transition: input.loopTransition ?? 'slideup', transitionSec: 0.35 })
  }
  const W = input.width ?? 1080
  const H = input.height ?? 1920
  const cf = Math.max(0, Math.min(0.4, input.crossfade ?? 0))
  const dir = await mkdtemp(path.join(tmpdir(), 'pcut-'))
  try {
    const args = ['-hide_banner', '-y']
    const filters: string[] = []
    const durs: number[] = []
    for (const [i, s] of shots.entries()) {
      const d = s.to - s.from
      durs.push(d)
      if (s.image) {
        const f = path.join(dir, `s${i}.img`)
        await writeFile(f, s.image)
        args.push('-loop', '1', '-framerate', '30', '-t', d.toFixed(3), '-i', f)
      } else if (s.video) {
        const f = path.join(dir, `s${i}.mp4`)
        await writeFile(f, s.video)
        args.push('-ss', s.from.toFixed(3), '-t', d.toFixed(3), '-i', f)
      } else {
        throw new Error(`shot ${i} has no video or image`)
      }
      const z = Math.max(0, Math.min(0.5, s.zoom ?? 0))
      const frames = Math.max(1, Math.round((s.zoomSec ?? 0.8) * 30))
      const zoom = z > 0
        ? `,scale=${W * 2}:${H * 2}:flags=lanczos,zoompan=z='1+${z.toFixed(3)}*(1-pow(1-min(1\\,on/${frames})\\,3))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=30`
        : ''
      filters.push(
        `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=30,setsar=1${zoom},format=yuv420p,setpts=PTS-STARTPTS,settb=AVTB[v${i}]`,
      )
    }
    // Join shots pairwise: hard cut = concat; anything else = xfade (overlaps the two shots).
    let last = '[v0]'
    let total = durs[0]!
    for (let i = 1; i < shots.length; i++) {
      const asked = shots[i]!.transition
      const kind: ProductTransition = asked && TRANSITIONS.has(asked) ? asked : cf > 0 ? 'fade' : 'cut'
      const out = `[j${i}]`
      if (kind === 'cut') {
        filters.push(`${last}[v${i}]concat=n=2:v=1:a=0${out}`)
        total += durs[i]!
      } else {
        const d = Math.max(0.1, Math.min(shots[i]!.transitionSec ?? (kind === 'fade' && cf > 0 ? cf : 0.3), durs[i]! - 0.05, total - 0.05))
        filters.push(`${last}[v${i}]xfade=transition=${kind}:duration=${d.toFixed(3)}:offset=${(total - d).toFixed(3)}${out}`)
        total += durs[i]! - d
      }
      last = out
    }

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

    const audioIdx = shots.length
    args.push('-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo')
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
