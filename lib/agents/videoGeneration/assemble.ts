import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

/**
 * Edit step for generated videos (approach reset 2026-10-18): the model renders the performance;
 * everything that must be exact is added here — subtitles timed to the actual speech, real images
 * shown as cut-ins, an end card with the real logo. ffmpeg runs in the function.
 */

export type TimedText = { start: number; end: number; text: string }
export type AssembleInput = {
  video: Buffer
  /** Script lines in spoken order — subtitles show these words, timed to the detected speech. */
  lines: string[]
  /** Burn subtitles of the spoken lines (user choice; default on). Timing is still computed either way. */
  subtitles?: boolean
  /** A real image (product, website screenshot, a post) shown over the video while line `line` is spoken. */
  insert?: { image: Buffer; line: number } | null
  endCard?: { text: string; logo?: Buffer | null; background?: string; seconds?: number } | null
}
export type AssembleResult = { video: Buffer; lineTimes: TimedText[]; chunks: TimedText[]; durationSec: number }

export function ffmpegBinary(): string {
  const local = path.join(process.cwd(), 'node_modules/@ffmpeg-installer/linux-x64/ffmpeg')
  if (existsSync(local) && process.platform === 'linux' && process.arch === 'x64') return local
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('@ffmpeg-installer/ffmpeg') as { path: string }).path
  } catch {
    return 'ffmpeg'
  }
}

export function fontPath(): string {
  return path.join(process.cwd(), 'assets/fonts/Inter-ExtraBold.otf')
}

function run(args: string[], timeoutMs = 120_000): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegBinary(), args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    p.stderr.on('data', d => { stderr += String(d); if (stderr.length > 400_000) stderr = stderr.slice(-200_000) })
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('ffmpeg timeout')) }, timeoutMs)
    p.on('error', e => { clearTimeout(t); reject(e) })
    p.on('close', code => { clearTimeout(t); resolve({ code: code ?? 1, stderr }) })
  })
}

async function must(args: string[], label: string) {
  const r = await run(args)
  if (r.code !== 0) throw new Error(`ffmpeg ${label} failed: ${r.stderr.slice(-800)}`)
  return r.stderr
}

export async function probe(file: string): Promise<{ duration: number; width: number; height: number }> {
  const { stderr } = await run(['-hide_banner', '-i', file])
  const d = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/)
  const s = stderr.match(/Video:.*?(\d{3,5})x(\d{3,5})/)
  return {
    duration: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0,
    width: s ? Number(s[1]) : 720,
    height: s ? Number(s[2]) : 1280,
  }
}

/** Speech segments = the gaps between detected silences. */
export async function speechSegments(file: string, duration: number): Promise<Array<{ start: number; end: number }>> {
  const { stderr } = await run(['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-32dB:d=0.22', '-f', 'null', '-'])
  const silences: Array<{ start: number; end: number }> = []
  let open: number | null = null
  for (const m of stderr.matchAll(/silence_(start|end):\s*([\d.]+)/g)) {
    const t = Number(m[2])
    if (m[1] === 'start') open = t
    else if (open !== null) { silences.push({ start: open, end: t }); open = null }
  }
  if (open !== null) silences.push({ start: open, end: duration })
  const segs: Array<{ start: number; end: number }> = []
  let cursor = 0
  for (const s of silences) {
    if (s.start - cursor > 0.15) segs.push({ start: cursor, end: s.start })
    cursor = s.end
  }
  if (duration - cursor > 0.15) segs.push({ start: cursor, end: duration })
  return segs.length ? segs : [{ start: 0, end: duration }]
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean)

/**
 * Place each script line on the speech timeline. Exact match when the number of speech segments
 * equals the number of lines; otherwise distribute lines by word count across the spoken time
 * (skipping the silences), which stays close for a single continuous take.
 */
export function alignLines(lines: string[], segs: Array<{ start: number; end: number }>): TimedText[] {
  if (segs.length === lines.length) return lines.map((text, i) => ({ start: segs[i]!.start, end: segs[i]!.end, text }))
  const spoken = segs.reduce((n, s) => n + (s.end - s.start), 0)
  const counts = lines.map(l => Math.max(1, words(l).length))
  const total = counts.reduce((a, b) => a + b, 0)
  const toClock = (speechT: number) => {
    let acc = 0
    for (const s of segs) {
      const len = s.end - s.start
      if (speechT <= acc + len) return s.start + (speechT - acc)
      acc += len
    }
    return segs[segs.length - 1]!.end
  }
  let acc = 0
  return lines.map((text, i) => {
    const a = toClock((acc / total) * spoken)
    acc += counts[i]!
    const b = toClock((acc / total) * spoken)
    return { start: a, end: b, text }
  })
}

/** 2–3 word subtitle chunks, timed by character share within each line. */
export function chunkLines(lineTimes: TimedText[]): TimedText[] {
  const out: TimedText[] = []
  for (const l of lineTimes) {
    // Never let a chunk straddle a sentence break ("every week. Even").
    const groups: string[][] = []
    for (const sentence of l.text.match(/[^.!?]+[.!?]*/g) ?? [l.text]) {
      const w = words(sentence)
      for (let i = 0; i < w.length;) {
        const left = w.length - i
        const take = left === 4 ? 2 : Math.min(3, left)
        groups.push(w.slice(i, i + take))
        i += take
      }
    }
    const chars = groups.map(g => g.join(' ').length)
    const sum = chars.reduce((a, b) => a + b, 0) || 1
    let t = l.start
    groups.forEach((g, gi) => {
      const len = ((l.end - l.start) * chars[gi]!) / sum
      out.push({ start: t, end: t + len, text: g.join(' ') })
      t += len
    })
  }
  return out
}

export async function assembleVideo(input: AssembleInput): Promise<AssembleResult> {
  const dir = await mkdtemp(path.join(tmpdir(), 'asm-'))
  try {
    const src = path.join(dir, 'src.mp4')
    await writeFile(src, input.video)
    const meta = await probe(src)
    const W = meta.width
    const H = meta.height
    const segs = await speechSegments(src, meta.duration)
    const lineTimes = alignLines(input.lines.filter(l => l.trim()), segs)
    const chunks = chunkLines(lineTimes)

    // ── Pass 1: subtitles (+ optional real-image cut-in) over the performance ──
    const font = fontPath().replace(/:/g, '\\:')
    const size = Math.round(H * 0.05)
    const border = Math.max(3, Math.round(H * 0.0045))
    const y = Math.round(H * 0.66)
    const filters: string[] = []
    let last = '[0:v]'
    const args = ['-hide_banner', '-y', '-i', src]
    if (input.insert?.image) {
      const img = path.join(dir, 'insert')
      await writeFile(img, input.insert.image)
      const lt = lineTimes[Math.min(Math.max(0, input.insert.line), lineTimes.length - 1)]!
      const a = Math.max(0, lt.start - 0.1)
      const b = Math.min(meta.duration, lt.end + 0.4)
      args.push('-loop', '1', '-t', String(meta.duration), '-i', img)
      const iw = Math.round(W * 0.78)
      filters.push(
        `[1:v]scale=${iw}:-2,format=rgba,pad=iw+12:ih+12:6:6:color=white@1,fade=t=in:st=${a.toFixed(2)}:d=0.25:alpha=1,fade=t=out:st=${(b - 0.25).toFixed(2)}:d=0.25:alpha=1[ins]`,
        `${last}[ins]overlay=x=(W-w)/2:y=H*0.1:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})'[v1]`,
      )
      last = '[v1]'
    }
    for (let i = 0; input.subtitles !== false && i < chunks.length; i++) {
      const c = chunks[i]!
      const tf = path.join(dir, `c${i}.txt`)
      await writeFile(tf, c.text)
      const out = `[s${i}]`
      filters.push(
        `${last}drawtext=fontfile='${font}':textfile='${tf}':fontcolor=white:fontsize=${size}:borderw=${border}:bordercolor=black@0.95:x=(w-text_w)/2:y=${y}:enable='between(t,${c.start.toFixed(2)},${c.end.toFixed(2)})'${out}`,
      )
      last = out
    }
    const main = path.join(dir, 'main.mp4')
    args.push(
      '-filter_complex', filters.length ? filters.join(';') : 'null',
      ...(filters.length ? ['-map', last] : ['-map', '0:v']),
      '-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2', '-shortest', main,
    )
    await must(args, 'subtitles')

    // ── Pass 2: end card (real logo + line) and join ──
    let final = main
    let total = meta.duration
    if (input.endCard) {
      const secs = input.endCard.seconds ?? 1.8
      const bg = (input.endCard.background ?? '0x111111').replace('#', '0x')
      const tf = path.join(dir, 'end.txt')
      await writeFile(tf, input.endCard.text)
      const card = path.join(dir, 'card.mp4')
      const cardArgs = ['-hide_banner', '-y', '-f', 'lavfi', '-i', `color=c=${bg}:s=${W}x${H}:d=${secs}:r=30`,
        '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo`]
      const cf: string[] = []
      let cl = '[0:v]'
      if (input.endCard.logo) {
        const logo = path.join(dir, 'logo')
        await writeFile(logo, input.endCard.logo)
        cardArgs.push('-loop', '1', '-t', String(secs), '-i', logo)
        cf.push(`[2:v]scale=${Math.round(W * 0.42)}:-2[lg]`, `${cl}[lg]overlay=x=(W-w)/2:y=(H-h)/2-H*0.04[c1]`)
        cl = '[c1]'
      }
      cf.push(`${cl}drawtext=fontfile='${font}':textfile='${tf}':fontcolor=white:fontsize=${Math.round(H * 0.032)}:x=(w-text_w)/2:y=H*0.62,fade=t=in:st=0:d=0.3[cv]`)
      cardArgs.push('-filter_complex', cf.join(';'), '-map', '[cv]', '-map', '1:a', '-t', String(secs),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', card)
      await must(cardArgs, 'end card')
      const joined = path.join(dir, 'final.mp4')
      await must(['-hide_banner', '-y', '-i', main, '-i', card, '-filter_complex', '[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]',
        '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', joined], 'join')
      final = joined
      total += secs
    }
    return { video: await readFile(final), lineTimes, chunks, durationSec: total }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
