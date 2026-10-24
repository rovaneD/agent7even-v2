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
  /**
   * User's caption choice (with `subtitles`): 'serif' = Cormorant SemiBold, 'sans' = Inter Bold.
   * Both: sentence case, soft shadow, no outline, 3-word groups at chest height. 'bold' = legacy outlined.
   */
  captionStyle?: 'serif' | 'sans' | 'bold'
  /** A real image (product, website screenshot, a post) shown over the video while line `line` is spoken. */
  insert?: { image: Buffer; line: number } | null
  endCard?: { text: string; logo?: Buffer | null; background?: string; seconds?: number } | null
  /**
   * Exact line times when the voice track was built line by line (presenter pipeline). Skips speech
   * detection; captions and cards land on the real words.
   */
  lineTimes?: TimedText[] | null
}
export type AssembleResult = { video: Buffer; lineTimes: TimedText[]; chunks: TimedText[]; durationSec: number; exactTiming: boolean }

/** Fit an image inside maxW x maxH and round its corners (~3.5% of width). Returns PNG + whether it is wide. */
export async function roundedCard(image: Buffer, maxW: number, maxH: number): Promise<{ png: Buffer; wide: boolean }> {
  const sharp = (await import('sharp')).default
  const resized = await sharp(image).resize({ width: maxW, height: maxH, fit: 'inside' }).png().toBuffer()
  const meta = await sharp(resized).metadata()
  const w = meta.width ?? maxW
  const h = meta.height ?? maxH
  const r = Math.round(w * 0.035)
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}"/></svg>`)
  const png = await sharp(resized).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
  return { png, wide: w > h * 1.15 }
}

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

export function fontPath(style: 'serif' | 'sans' | 'bold' = 'bold'): string {
  const file = style === 'serif' ? 'Cormorant-SemiBold.ttf' : style === 'sans' ? 'Inter-Bold.otf' : 'Inter-ExtraBold.otf'
  return path.join(process.cwd(), 'assets/fonts', file)
}

export function run(args: string[], timeoutMs = 120_000): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegBinary(), args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    p.stderr.on('data', d => { stderr += String(d); if (stderr.length > 400_000) stderr = stderr.slice(-200_000) })
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('ffmpeg timeout')) }, timeoutMs)
    p.on('error', e => { clearTimeout(t); reject(e) })
    p.on('close', code => { clearTimeout(t); resolve({ code: code ?? 1, stderr }) })
  })
}

export async function must(args: string[], label: string) {
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
export async function speechSegments(file: string, duration: number, opts?: { noiseDb?: number; minSilence?: number }): Promise<Array<{ start: number; end: number }>> {
  const nz = opts?.noiseDb ?? -32
  const d = opts?.minSilence ?? 0.22
  const { stderr } = await run(['-hide_banner', '-i', file, '-af', `silencedetect=noise=${nz}dB:d=${d}`, '-f', 'null', '-'])
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

/**
 * Try several silence thresholds and keep the one whose speech segments match the number of script
 * lines (exact line timing). Ambient room tone often hides pauses at one fixed threshold.
 */
export async function speechSegmentsForLines(file: string, duration: number, lineCount: number) {
  let best: Array<{ start: number; end: number }> | null = null
  for (const noiseDb of [-32, -28, -25, -22, -36, -40]) {
    for (const minSilence of [0.22, 0.15, 0.3]) {
      const segs = await speechSegments(file, duration, { noiseDb, minSilence })
      if (segs.length === lineCount) return { segs, exact: true }
      if (!best || Math.abs(segs.length - lineCount) < Math.abs(best.length - lineCount)) best = segs
    }
  }
  return { segs: best ?? [{ start: 0, end: duration }], exact: false }
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
/** Greedy word wrap to lines of at most `max` characters (a single long word stays whole). */
export function wrapWords(text: string, max: number): string[] {
  const out: string[] = []
  let line = ''
  for (const w of text.trim().split(/\s+/).filter(Boolean)) {
    if (!line) line = w
    else if ((line + ' ' + w).length <= max) line += ' ' + w
    else {
      out.push(line)
      line = w
    }
  }
  if (line) out.push(line)
  return out
}

export function chunkLines(lineTimes: TimedText[]): TimedText[] {
  const out: TimedText[] = []
  for (const l of lineTimes) {
    // Never let a chunk straddle a sentence break ("every week. Even").
    const groups: string[][] = []
    for (const sentence of l.text.match(/[^.!?]+[.!?]*/g) ?? [l.text]) {
      const w = words(sentence)
      for (let i = 0; i < w.length;) {
        const left = w.length - i
        let take = left === 4 ? 2 : Math.min(3, left)
        while (take > 1 && w.slice(i, i + take).join(' ').length > 22) take--
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
    const lines = input.lines.filter(l => l.trim())
    const given = input.lineTimes?.length === lines.length ? input.lineTimes : null
    const detected = given ? null : await speechSegmentsForLines(src, meta.duration, lines.length)
    const exact = given ? true : detected!.exact
    const lineTimes = given
      ? given.map((t, i) => ({ start: t.start, end: Math.min(t.end, meta.duration), text: lines[i]! }))
      : alignLines(lines, detected!.segs)
    const chunks = chunkLines(lineTimes)

    // ── Pass 1: subtitles (+ optional real-image cut-in) over the performance ──
    const style = input.captionStyle ?? 'serif'
    const creator = style !== 'bold' // serif and sans share the creator look
    const serif = creator
    const font = fontPath(style).replace(/:/g, '\\:')
    const endFont = fontPath('bold').replace(/:/g, '\\:')
    // Creator captions at chest height (0.73H). Example #1 review (2026-10-20): 0.036H serif with a thin
    // shadow was unreadable on a light shirt, so both styles are larger and get a soft dark halo
    // (thin semi-transparent border + drop shadow) — still no hard outline.
    // Sans glyphs read larger than Cormorant at the same size, so it stays a touch smaller.
    const size = Math.round(H * (style === 'serif' ? 0.048 : style === 'sans' ? 0.037 : 0.05))
    const border = Math.max(3, Math.round(H * 0.0045))
    const y = Math.round(H * (serif ? 0.73 : 0.66))
    const textStyle = serif
      ? `fontcolor=white:fontsize=${size}:borderw=${Math.max(2, Math.round(H * 0.0022))}:bordercolor=black@0.38:shadowcolor=black@0.6:shadowx=0:shadowy=${Math.max(2, Math.round(H * 0.002))}`
      : `fontcolor=white:fontsize=${size}:borderw=${border}:bordercolor=black@0.95`
    const filters: string[] = []
    let last = '[0:v]'
    const args = ['-hide_banner', '-y', '-i', src]
    if (input.insert?.image) {
      const img = path.join(dir, 'insert')
      await writeFile(img, input.insert.image)
      const lt = lineTimes[Math.min(Math.max(0, input.insert.line), lineTimes.length - 1)]!
      // Card shows on the line that names it, 1.3–3s (skill rule); never during the closing words.
      const a = Math.max(0, lt.start + 0.15)
      const b = Math.min(meta.duration, a + Math.min(3, Math.max(1.3, lt.end - lt.start - 0.3)))
      args.push('-loop', '1', '-t', String(meta.duration), '-i', img)
      // Rounded corners (~3.5% of width). Example #1 review (2026-10-20): a 0.55H card centered at 0.33H
      // covered the presenter's face for 3s. Cards now sit at chest height between the chin (~0.36H)
      // and the captions (0.73H) so the face stays visible: wide up to 0.86W, tall up to 0.56W, both <= 0.31H (a clear gap above the captions).
      const card = await roundedCard(
        input.insert.image,
        Math.round(W * 0.86),
        Math.round(H * 0.31),
      )
      const tall = !card.wide
      const sized = tall ? await roundedCard(input.insert.image, Math.round(W * 0.56), Math.round(H * 0.31)) : card
      await writeFile(img, sized.png)
      const top = Math.round(H * 0.36)
      filters.push(
        `[1:v]format=rgba,fade=t=in:st=${a.toFixed(2)}:d=0.2:alpha=1,fade=t=out:st=${(b - 0.2).toFixed(2)}:d=0.2:alpha=1[ins]`,
        `${last}[ins]overlay=x=(W-w)/2:y=${top}:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})'[v1]`,
      )
      last = '[v1]'
    }
    for (let i = 0; input.subtitles !== false && i < chunks.length; i++) {
      const c = chunks[i]!
      const tf = path.join(dir, `c${i}.txt`)
      await writeFile(tf, c.text)
      const out = `[s${i}]`
      filters.push(
        `${last}drawtext=fontfile='${font}':textfile='${tf}':${textStyle}:x=(w-text_w)/2:y=${y}-text_h/2:enable='between(t,${c.start.toFixed(2)},${c.end.toFixed(2)})'${out}`,
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
      const secs = input.endCard.seconds ?? (input.endCard.text.length > 22 ? 2.3 : 1.8)
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
      // Wrap the end line (drawtext doesn't): ~22 chars per line keeps it inside a 9:16 frame.
      // Example #1 (2026-10-24): a 50-character line ran off both edges.
      const endLines = wrapWords(input.endCard.text, 22).slice(0, 3)
      const endSize = Math.round(H * (endLines.length > 1 ? 0.029 : 0.032))
      for (let i = 0; i < endLines.length; i++) {
        const lf = path.join(dir, `end${i}.txt`)
        await writeFile(lf, endLines[i]!)
        const next = i === endLines.length - 1 ? '[ct]' : `[e${i}]`
        cf.push(`${cl}drawtext=fontfile='${endFont}':textfile='${lf}':fontcolor=white:fontsize=${endSize}:x=(w-text_w)/2:y=H*0.62+${Math.round(i * endSize * 1.3)}${next}`)
        cl = next
      }
      if (!endLines.length) cf.push(`${cl}null[ct]`)
      cf.push(`[ct]fade=t=in:st=0:d=0.3[cv]`)
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
    return { video: await readFile(final), lineTimes, chunks, durationSec: total, exactTiming: exact }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
