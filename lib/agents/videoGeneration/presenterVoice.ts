import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { must, run, type TimedText } from './assemble'
import { speakAsCreator } from '@/lib/agents/voice/creatorVoice'

/**
 * Presenter voice track, built line by line: each script line is spoken in the creator's voice, its
 * leading/trailing silence trimmed, then joined with short natural gaps. Because every line is its own
 * clip we know exactly when each line starts and ends — captions and cards use these times instead of
 * guessing from pauses in the finished video.
 */

const LEAD_IN = 0.25 // seconds of room before the first word
const GAP = 0.15 // between lines — a breath, not a pause (owner 2026-10-26: delivery was too slow)
/**
 * Speaking pace. The cloned voices read at ~2.5 words/s, which the owner heard as "too slow"
 * (2026-10-26); real creators talk ~3 w/s. atempo speeds the speech up without changing the pitch.
 */
const TEMPO = Math.min(1.3, Math.max(1, Number(process.env.CREATOR_VOICE_TEMPO ?? 1.15) || 1.15))
const TAIL = 0.35

async function durationOf(file: string): Promise<number> {
  const { stderr } = await run(['-hide_banner', '-i', file])
  const d = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/)
  return d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0
}

export async function buildCreatorVoiceTrack(opts: {
  voiceSamplePath: string
  lines: string[]
}): Promise<{ audio: Buffer; lineTimes: TimedText[]; durationSec: number }> {
  const lines = opts.lines.map(l => l.trim()).filter(Boolean)
  if (!lines.length) throw new Error('no_lines')
  const clips = await Promise.all(lines.map(text => speakAsCreator({ voiceSamplePath: opts.voiceSamplePath, text })))
  return joinVoiceClips(clips, lines)
}

/** Trim each spoken line and join them with short gaps; returns the track and exact line times. */
export async function joinVoiceClips(
  clips: Buffer[],
  lines: string[],
): Promise<{ audio: Buffer; lineTimes: TimedText[]; durationSec: number }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'voice-'))
  try {
    const trimmed: string[] = []
    const durs: number[] = []
    for (let i = 0; i < clips.length; i++) {
      const raw = path.join(dir, `l${i}.mp3`)
      const out = path.join(dir, `l${i}.wav`)
      await writeFile(raw, clips[i]!)
      // Trim silence at both ends (reverse trick for the tail), mono 44.1 kHz.
      await must(
        [
          '-hide_banner', '-y', '-i', raw,
          '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse' + (TEMPO > 1 ? `,atempo=${TEMPO.toFixed(3)}` : ''),
          '-ac', '1', '-ar', '44100', out,
        ],
        `trim line ${i + 1}`,
      )
      trimmed.push(out)
      durs.push(await durationOf(out))
    }

    const lineTimes: TimedText[] = []
    let t = LEAD_IN
    for (let i = 0; i < lines.length; i++) {
      lineTimes.push({ start: t, end: t + durs[i]!, text: lines[i]! })
      t += durs[i]! + (i < lines.length - 1 ? GAP : 0)
    }
    const total = t + TAIL

    // Join: lead-in silence, line, gap, line, … , tail.
    const parts: string[] = []
    const inputs: string[] = []
    const silence = (sec: number, idx: number) => `anullsrc=r=44100:cl=mono,atrim=0:${sec.toFixed(3)}[s${idx}]`
    const filters: string[] = [silence(LEAD_IN, 0)]
    parts.push('[s0]')
    trimmed.forEach((f, i) => {
      inputs.push('-i', f)
      parts.push(`[${i}:a]`)
      const gap = i < trimmed.length - 1 ? GAP : TAIL
      filters.push(silence(gap, i + 1))
      parts.push(`[s${i + 1}]`)
    })
    filters.push(`${parts.join('')}concat=n=${parts.length}:v=0:a=1[out]`)
    const joined = path.join(dir, 'track.mp3')
    await must(
      ['-hide_banner', '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '160k', '-ar', '44100', joined],
      'join lines',
    )
    return { audio: await readFile(joined), lineTimes, durationSec: total }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
