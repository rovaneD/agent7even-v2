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
export type ProductShot = { video: Buffer; from: number; to: number }
export type ProductText = { text: string; start: number; end: number }
export type ProductCutInput = {
  shots: ProductShot[]
  /** Optional on-screen text, on the output timeline (seconds). Off unless the user turns it on. */
  texts?: ProductText[]
  /** 0 = hard cuts (default, like the reference). >0 = crossfade seconds between shots. */
  crossfade?: number
  width?: number
  height?: number
}

export async function assembleProductCut(input: ProductCutInput): Promise<{ video: Buffer; durationSec: number }> {
  const shots = input.shots.filter(s => s.to - s.from >= 0.3)
  if (!shots.length) throw new Error('no shots')
  const W = input.width ?? 1080
  const H = input.height ?? 1920
  const cf = Math.max(0, Math.min(0.4, input.crossfade ?? 0))
  const dir = await mkdtemp(path.join(tmpdir(), 'pcut-'))
  try {
    const args = ['-hide_banner', '-y']
    const filters: string[] = []
    const durs: number[] = []
    for (const [i, s] of shots.entries()) {
      const f = path.join(dir, `s${i}.mp4`)
      await writeFile(f, s.video)
      const d = s.to - s.from
      durs.push(d)
      args.push('-ss', s.from.toFixed(3), '-t', d.toFixed(3), '-i', f)
      filters.push(
        `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=30,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v${i}]`,
      )
    }
    let last: string
    let total: number
    if (cf > 0 && shots.length > 1) {
      last = '[v0]'
      let t = durs[0]!
      for (let i = 1; i < shots.length; i++) {
        const out = `[x${i}]`
        filters.push(`${last}[v${i}]xfade=transition=fade:duration=${cf.toFixed(2)}:offset=${(t - cf).toFixed(3)}${out}`)
        t += durs[i]! - cf
        last = out
      }
      total = t
    } else {
      filters.push(`${shots.map((_, i) => `[v${i}]`).join('')}concat=n=${shots.length}:v=1:a=0[cat]`)
      last = '[cat]'
      total = durs.reduce((a, b) => a + b, 0)
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
