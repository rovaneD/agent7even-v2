/**
 * Throwaway A/B spike: Foundation-grounded vs shallow prompts for post images + reels.
 * Usage: npx tsx spikes/foundation-creative-ab/run.ts [--images-only] [--videos-only]
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')
const OUT = path.join(__dirname, 'output')
const OPENROUTER = 'https://openrouter.ai/api/v1'
const BRIEF_MODEL = 'anthropic/claude-sonnet-4'
const IMAGE_CONCEPTS = 3
const VIDEO_CONCEPTS = 2

const SHALLOW_IMAGE_BRIEFS = [
  'Professional marketing image for an AI marketing platform for small businesses. Modern SaaS aesthetic, clean dashboard mockup feel, generic tech blue gradient.',
  'Instagram carousel cover for an AI marketing tool that helps small businesses with social content. Friendly, approachable, stock-photo style entrepreneur at laptop.',
  'Premium stat-style social post with headline text "Your marketing team, powered by AI" for a small-business SaaS. Minimal layout, generic startup branding.',
]

const SHALLOW_VIDEO_BRIEFS = [
  'Short vertical promo reel for an AI marketing tool for small businesses. Upbeat UGC-style, person talking to camera about saving time on marketing.',
  '15-second vertical ad for a SaaS marketing platform targeting SMB owners. Fast cuts, generic office, AI dashboard overlays, energetic stock music vibe.',
]

function loadEnvLocal(): void {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) throw new Error('Missing .env.local')
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

function orHeaders(): Record<string, string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY missing')
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://agent7even-v2.vercel.app',
    'X-Title': 'Agent7even Foundation Creative Spike',
  }
}

async function orJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...orHeaders(), ...init?.headers } })
  const text = await res.text()
  if (!res.ok) throw new Error(`OpenRouter ${res.status} ${url}: ${text.slice(0, 800)}`)
  return JSON.parse(text) as T
}

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true })
}

function writeText(rel: string, content: string): void {
  const full = path.join(OUT, rel)
  ensureDir(path.dirname(full))
  fs.writeFileSync(full, content, 'utf8')
}

type OrModel = { id: string; name?: string; architecture?: { output_modalities?: string[] } }

async function fetchImageModels(): Promise<string[]> {
  const data = await orJson<{ data: OrModel[] }>(`${OPENROUTER}/models?output_modalities=image`)
  const ids = data.data.map(m => m.id)
  writeText('models-image-live.json', JSON.stringify(data.data.map(m => ({ id: m.id, name: m.name })), null, 2))

  const prefer = [
    'google/gemini-2.5-flash-image',
    'google/gemini-3.1-flash-image-preview',
    'sourceful/riverflow-v2.5-pro',
    'recraft/recraft-v4-pro',
    'black-forest-labs/flux.2-pro',
  ]
  const picked: string[] = []
  for (const p of prefer) {
    if (ids.includes(p) && picked.length < 2) picked.push(p)
  }
  for (const id of ids) {
    if (picked.length >= 2) break
    if (!picked.includes(id)) picked.push(id)
  }
  if (picked.length < 2) picked.push(...ids.slice(0, 2 - picked.length))
  return [...new Set(picked)].slice(0, 2)
}

async function fetchVideoModels(): Promise<string[]> {
  const data = await orJson<{ data: Array<{ id: string; name?: string; pricing_skus?: Record<string, string> }> }>(
    `${OPENROUTER}/videos/models`,
  )
  writeText('models-video-live.json', JSON.stringify(data.data, null, 2))
  const ids = data.data.map(m => m.id)

  const prefer = ['google/veo-3.1-lite', 'google/veo-3.1', 'alibaba/wan-2.7', 'minimax/video-01']
  const picked: string[] = []
  for (const p of prefer) {
    if (ids.includes(p) && picked.length < 2) picked.push(p)
  }
  for (const id of ids) {
    if (picked.length >= 2) break
    if (!picked.includes(id)) picked.push(id)
  }
  return [...new Set(picked)].slice(0, 2)
}

async function loadFoundation(): Promise<{ profileId: string; companyName: string; markdown: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('Supabase env missing')

  const supabase = createClient(url, key)
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, company_name, foundation_answers, foundation_score')
    .or('company_name.ilike.%agent7even%,company_name.ilike.%Agent7even%')
    .order('foundation_score', { ascending: false })
    .limit(5)

  if (error) throw new Error(`Supabase profiles: ${error.message}`)

  let profile = profiles?.[0]
  if (!profile) {
    const { data: fallback } = await supabase
      .from('profiles')
      .select('id, company_name, foundation_answers, foundation_score')
      .not('foundation_answers', 'is', null)
      .order('foundation_score', { ascending: false })
      .limit(1)
    profile = fallback?.[0]
  }
  if (!profile) throw new Error('No profile with foundation found')

  const { data: docs } = await supabase
    .from('foundation_documents')
    .select('type, markdown')
    .eq('user_id', profile.id)

  const answers = (profile.foundation_answers ?? {}) as Record<string, unknown>
  const docMap = Object.fromEntries((docs ?? []).map(d => [d.type, d.markdown]))
  const sections: string[] = [
    `# Foundation snapshot — ${profile.company_name ?? profile.id}`,
    `Profile ID: ${profile.id}`,
    '',
    '## Documents',
  ]
  for (const t of ['brief', 'icp', 'positioning', 'voice', 'plan'] as const) {
    if (docMap[t]) sections.push(`### ${t}\n${docMap[t]}\n`)
  }
  sections.push('## Raw answers (JSONB)')
  for (const [k, v] of Object.entries(answers)) {
    if (v == null || v === '') continue
    sections.push(`- **${k}**: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
  }

  const markdown = sections.join('\n')
  writeText('foundation-snapshot.md', markdown)
  return { profileId: profile.id, companyName: profile.company_name ?? 'Agent7even', markdown }
}

async function generateGroundedBriefs(
  foundationMd: string,
  kind: 'image' | 'video',
  count: number,
): Promise<string[]> {
  const kindSpec =
    kind === 'image'
      ? `Write exactly ${count} distinct Instagram/LinkedIn POST IMAGE generation prompts for Agent7even.
Each prompt must be a self-contained paragraph (150-350 words) with: visual composition, color palette tied to brand (#3B82F6 primary blue, restrained pink #F5349B for logo moments only), typography/text to render ON the image, mood, what to avoid (generic AI slop, business-in-a-box templates).
Include one carousel cover, one stat/insight post with readable headline text, one quote/thought-leadership card.
Do NOT mention "Foundation" — write as if briefing a designer.`
      : `Write exactly ${count} distinct vertical REEL / short video prompts (9:16) for Agent7even.
Each prompt must be a self-contained paragraph (150-350 words) with: scene beats, camera motion, on-screen text, voiceover tone matching brand voice, ICP (small business owners who want control/premium feel not hype), pacing, what to avoid (generic AI UGC, fake guru energy).
Concepts: (1) control/premium positioning reel, (2) product value reel showing Maya + marketing workflow.
Do NOT mention "Foundation".`

  const res = await orJson<{
    choices: Array<{ message: { content: string } }>
  }>(`${OPENROUTER}/chat/completions`, {
    method: 'POST',
    body: JSON.stringify({
      model: BRIEF_MODEL,
      temperature: 0.6,
      max_tokens: 4000,
      messages: [
        {
          role: 'system',
          content:
            'You are Maya, Agent7even\'s brand strategist. Output ONLY valid JSON: { "briefs": string[] } with the requested count. No markdown fences.',
        },
        {
          role: 'user',
          content: `${kindSpec}\n\n--- FOUNDATION ---\n${foundationMd.slice(0, 28000)}`,
        },
      ],
    }),
  })

  const raw = res.choices[0]?.message?.content ?? ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Brief LLM did not return JSON: ${raw.slice(0, 500)}`)
  const parsed = JSON.parse(jsonMatch[0]) as { briefs?: string[] }
  const briefs = (parsed.briefs ?? []).filter(Boolean)
  if (briefs.length < count) throw new Error(`Expected ${count} ${kind} briefs, got ${briefs.length}`)
  return briefs.slice(0, count)
}

type ImageGenResponse = {
  choices?: Array<{
    message?: {
      images?: Array<{ image_url?: { url?: string }; imageUrl?: { url?: string } }>
    }
  }>
}

async function generateImage(model: string, prompt: string): Promise<Buffer> {
  const modalities = model.startsWith('recraft/') || model.includes('flux')
    ? ['image']
    : ['image', 'text']

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    modalities,
    stream: false,
    image_config: {
      aspect_ratio: '4:5',
      image_size: '1K',
    },
  }

  if (model.includes('recraft')) {
    body.image_config = {
      aspect_ratio: '4:5',
      rgb_colors: [[59, 130, 246], [255, 255, 255]],
      background_rgb_color: [255, 255, 255],
    }
  }

  const data = await orJson<ImageGenResponse>(`${OPENROUTER}/chat/completions`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const images = data.choices?.[0]?.message?.images ?? []
  const url = images[0]?.image_url?.url ?? images[0]?.imageUrl?.url
  if (!url) throw new Error(`No image in response for ${model}`)

  if (url.startsWith('data:')) {
    const b64 = url.split(',')[1]
    return Buffer.from(b64, 'base64')
  }
  const imgRes = await fetch(url)
  if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`)
  return Buffer.from(await imgRes.arrayBuffer())
}

async function generateVideo(
  model: string,
  prompt: string,
  label: string,
): Promise<{ buf: Buffer; cost?: number }> {
  const submit = await orJson<{ id: string; polling_url: string; status: string }>(`${OPENROUTER}/videos`, {
    method: 'POST',
    body: JSON.stringify({
      model,
      prompt,
      duration: 4,
      resolution: '720p',
      aspect_ratio: '9:16',
      generate_audio: false,
    }),
  })

  writeText(`video-jobs/${label}.json`, JSON.stringify(submit, null, 2))
  const pollUrl = submit.polling_url || `${OPENROUTER}/videos/${submit.id}`
  const started = Date.now()
  const maxMs = 20 * 60 * 1000

  while (Date.now() - started < maxMs) {
    await new Promise(r => setTimeout(r, 20_000))
    const status = await orJson<{
      status: string
      unsigned_urls?: string[]
      error?: string
      usage?: { cost?: number }
    }>(pollUrl)

    console.log(`  [${label}] ${status.status}`)
    if (status.status === 'completed') {
      const contentUrl = status.unsigned_urls?.[0] ?? `${OPENROUTER}/videos/${submit.id}/content?index=0`
      const vidRes = await fetch(contentUrl, { headers: orHeaders() })
      if (!vidRes.ok) throw new Error(`Video download failed: ${vidRes.status}`)
      const buf = Buffer.from(await vidRes.arrayBuffer())
      return { buf, cost: status.usage?.cost }
    }
    if (status.status === 'failed') {
      throw new Error(status.error ?? 'Video generation failed')
    }
  }
  throw new Error(`Video timed out: ${label}`)
}

async function runImages(imageModels: string[], grounded: string[], shallow: string[]): Promise<void> {
  for (const arm of ['a', 'b'] as const) {
    const briefs = arm === 'a' ? grounded : shallow
    for (let i = 0; i < IMAGE_CONCEPTS; i++) {
      writeText(`briefs/image-arm-${arm}-concept-${String(i + 1).padStart(2, '0')}.txt`, briefs[i])
    }
  }

  for (const model of imageModels) {
    const modelDir = slug(model)
    for (const arm of ['a', 'b'] as const) {
      const briefs = arm === 'a' ? grounded : shallow
      for (let i = 0; i < IMAGE_CONCEPTS; i++) {
        const concept = String(i + 1).padStart(2, '0')
        const outRel = `images/arm-${arm}/${modelDir}/concept-${concept}.png`
        const outFull = path.join(OUT, outRel)
        if (fs.existsSync(outFull)) {
          console.log(`Skip existing ${outRel}`)
          continue
        }
        console.log(`Image ${model} arm-${arm} concept-${concept}`)
        try {
          const buf = await generateImage(model, briefs[i])
          ensureDir(path.dirname(outFull))
          fs.writeFileSync(outFull, buf)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          writeText(`errors/image-${modelDir}-arm-${arm}-c${concept}.txt`, msg)
          console.error(`  FAILED: ${msg}`)
        }
      }
    }
  }
}

async function runVideos(videoModels: string[], grounded: string[], shallow: string[]): Promise<void> {
  for (const arm of ['a', 'b'] as const) {
    const briefs = arm === 'a' ? grounded : shallow
    for (let i = 0; i < VIDEO_CONCEPTS; i++) {
      writeText(`briefs/video-arm-${arm}-concept-${String(i + 1).padStart(2, '0')}.txt`, briefs[i])
    }
  }

  const costs: number[] = []
  for (const model of videoModels) {
    const modelDir = slug(model)
    for (const arm of ['a', 'b'] as const) {
      const briefs = arm === 'a' ? grounded : shallow
      for (let i = 0; i < VIDEO_CONCEPTS; i++) {
        const concept = String(i + 1).padStart(2, '0')
        const outRel = `video/arm-${arm}/${modelDir}/concept-${concept}.mp4`
        const outFull = path.join(OUT, outRel)
        if (fs.existsSync(outFull)) {
          console.log(`Skip existing ${outRel}`)
          continue
        }
        const label = `${modelDir}-arm-${arm}-c${concept}`
        console.log(`Video ${model} arm-${arm} concept-${concept}`)
        try {
          const { buf, cost } = await generateVideo(model, briefs[i], label)
          if (cost != null) costs.push(cost)
          ensureDir(path.dirname(outFull))
          fs.writeFileSync(outFull, buf)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          writeText(`errors/video-${label}.txt`, msg)
          console.error(`  FAILED: ${msg}`)
        }
      }
    }
  }
  writeText('video-costs.json', JSON.stringify({ costs, total: costs.reduce((a, b) => a + b, 0) }, null, 2))
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const imagesOnly = args.includes('--images-only')
  const videosOnly = args.includes('--videos-only')
  const runImagesFlag = !videosOnly
  const runVideosFlag = !imagesOnly

  loadEnvLocal()
  ensureDir(OUT)

  console.log('Loading Foundation…')
  const { companyName, markdown: foundationMd } = await loadFoundation()
  console.log(`Profile: ${companyName}`)

  console.log('Fetching live OpenRouter models…')
  const imageModels = process.env.SPIKE_IMAGE_MODELS?.split(',').filter(Boolean) ?? (await fetchImageModels())
  const videoModels = process.env.SPIKE_VIDEO_MODELS?.split(',').filter(Boolean) ?? (await fetchVideoModels())
  writeText('models-selected.json', JSON.stringify({ imageModels, videoModels, briefModel: BRIEF_MODEL }, null, 2))
  console.log('Image models:', imageModels)
  console.log('Video models:', videoModels)

  let imageGrounded: string[] = []
  let videoGrounded: string[] = []

  if (runImagesFlag) {
    console.log('Generating grounded IMAGE briefs…')
    imageGrounded = await generateGroundedBriefs(foundationMd, 'image', IMAGE_CONCEPTS)
  }
  if (runVideosFlag) {
    console.log('Generating grounded VIDEO briefs…')
    videoGrounded = await generateGroundedBriefs(foundationMd, 'video', VIDEO_CONCEPTS)
  }

  if (runImagesFlag) {
    console.log('Rendering images…')
    await runImages(imageModels, imageGrounded, SHALLOW_IMAGE_BRIEFS)
  }
  if (runVideosFlag) {
    console.log('Rendering videos (async, may take 10–20 min)…')
    await runVideos(videoModels, videoGrounded, SHALLOW_VIDEO_BRIEFS)
  }

  writeText(
    'manifest.json',
    JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        companyName,
        imageModels,
        videoModels,
        counts: { imageConcepts: IMAGE_CONCEPTS, videoConcepts: VIDEO_CONCEPTS },
      },
      null,
      2,
    ),
  )
  console.log('Done. Outputs in', OUT)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
