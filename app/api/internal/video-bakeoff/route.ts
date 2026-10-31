import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getWorkspaceAuthContext, workspaceDataUserId } from '@/lib/profiles/workspaceSession'
import { createPostAssetSignedUrl } from '@/lib/postAssets'
import { POST_ASSETS_BUCKET } from '@/lib/postAssetLimits'
import { openRouterHeaders } from '@/lib/agents/imageGeneration/openRouterImage'
import { pollVideoJob, submitVideoJob } from '@/lib/agents/videoGeneration/openRouterVideo'
import { composeVideoConcept, recipeLooks } from '@/lib/agents/videoGeneration/briefComposeConcept'
import { composeVideoStory } from '@/lib/agents/videoGeneration/storyCompose'
import { resolveVideoSkill } from '@/lib/agents/videoGeneration/videoSkills'
import { formatCreativeDirectionBlock, getOrComputeCreativeDirection } from '@/lib/agents/foundationCreativeDirection'
import { formatPostContextBriefBlock } from '@/lib/agents/imageGeneration/postContextBrief'

/**
 * Internal video-model bake-off (internal test accounts only, like image-bakeoff).
 * POST {prompts[], models[], duration?} submits every prompt × model job and returns job ids.
 * GET ?ids=a,b polls; finished clips are copied to post-assets and returned as signed URLs.
 * Jobs have no agent_task, so the production webhook ignores them.
 */
export const maxDuration = 180

const INTERNAL_EMAILS = new Set(['rovane@dursodesign.com', 'melissa@agent7even.com', 'rovdurs@gmail.com'])

async function auth() {
  const supabase = createServiceClient()
  const ctx = await getWorkspaceAuthContext(supabase)
  if (!ctx || !ctx.email || !INTERNAL_EMAILS.has(ctx.email.toLowerCase())) return null
  return { supabase, profileId: workspaceDataUserId(ctx.session) }
}

export async function POST(req: Request) {
  const a = await auth()
  if (!a) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const body = (await req.json().catch(() => ({}))) as {
    prompts?: string[]; models?: string[]; duration?: number
    references?: string[]; generateAudio?: boolean; resolution?: '480p' | '720p' | '1080p'
    firstFrame?: string; lastFrame?: string
    providerOptions?: Record<string, Record<string, unknown>>
    extraReferences?: Record<string, unknown>[]
    /** Run the production concept writer N times for this workspace instead of fixed prompts. */
    compose?: { count?: number; skillId?: string; post?: Record<string, string>; story?: boolean; brandUrl?: string }
  }
  let concepts: unknown[] = []
  if (body.compose) {
    const { data: prof } = await a.supabase.from('profiles').select('company_name').eq('id', a.profileId).maybeSingle()
    const companyName = (prof?.company_name as string | null) ?? 'your business'
    const skill = await resolveVideoSkill(a.supabase, body.compose.skillId)
    const cd = await getOrComputeCreativeDirection({ profileId: a.profileId, companyName })
    const cdBlock = formatCreativeDirectionBlock(cd, companyName)
    const postBlock = formatPostContextBriefBlock(body.compose.post ?? {}, 'video')
    const n = Math.min(4, Math.max(1, body.compose.count ?? 2))
    const looks = recipeLooks(skill.recipe)
    if (body.compose.story) {
      // Story mode: compose N stories, submit every shot, return jobs tagged with story/shot index.
      const stories = await Promise.all(Array.from({ length: n }, (_, i) =>
        composeVideoStory({ skill, creativeDirectionBlock: cdBlock, companyName, brandUrl: body.compose!.brandUrl ?? null, postContextBlock: postBlock, look: looks[i % Math.max(1, looks.length)] })
          .catch(e => ({ error: String(e) }))))
      const model = body.models?.[0] ?? skill.model
      const jobs = await Promise.all(stories.flatMap((st, si) => 'story' in st
        ? st.story.shots.map(async (shot, ki) => {
          try {
            const r = await submitVideoJob({ model, prompt: shot.prompt, aspectRatio: '9:16', duration: shot.seconds })
            return { story: si, shot: ki, model, jobId: r.id }
          } catch (err) {
            return { story: si, shot: ki, model, error: err instanceof Error ? err.message.slice(0, 300) : String(err) }
          }
        })
        : []))
      return NextResponse.json({ stories, jobs })
    }
    const results = await Promise.all(Array.from({ length: n }, (_, i) =>
      composeVideoConcept({ skill, creativeDirectionBlock: cdBlock, companyName, postContextBlock: postBlock, look: looks[i % Math.max(1, looks.length)] })
        .catch(e => ({ error: String(e) }))))
    concepts = results
    body.prompts = results.flatMap(r => ('concept' in r ? [r.concept.prompt] : []))
    if (!body.models?.length) body.models = [skill.model]
    if (!body.duration) body.duration = skill.duration_seconds
  }
  const prompts = (body.prompts ?? []).map(p => p.trim()).filter(Boolean).slice(0, 4)
  const models = (body.models ?? []).map(m => m.trim()).filter(Boolean).slice(0, 6)
  if (!prompts.length || !models.length) return NextResponse.json({ error: 'prompts_and_models_required' }, { status: 400 })
  const jobs = await Promise.all(
    prompts.flatMap((prompt, pi) => models.map(async model => {
      try {
        const r = await submitVideoJob({ model, prompt, aspectRatio: '9:16', duration: body.duration ?? 8, referenceUrls: (body.references ?? []).filter(u => /^https:\/\//.test(u)).slice(0, 4), generateAudio: body.generateAudio, resolution: body.resolution, providerOptions: body.providerOptions, extraReferences: body.extraReferences, firstFrameUrl: body.firstFrame, lastFrameUrl: body.lastFrame })
        return { prompt: pi + 1, model, jobId: r.id, submittedAt: Date.now() }
      } catch (err) {
        return { prompt: pi + 1, model, error: err instanceof Error ? err.message.slice(0, 1500) : String(err) }
      }
    })),
  )
  console.info('[video-bakeoff] submitted', JSON.stringify(jobs.map(j => ({ p: j.prompt, m: j.model, ok: 'jobId' in j }))))
  return NextResponse.json({ jobs, concepts })
}

export async function GET(req: Request) {
  const a = await auth()
  if (!a) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const ids = (new URL(req.url).searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 24)
  const results = await Promise.all(ids.map(async jobId => {
    try {
      const poll = await pollVideoJob(jobId) as Awaited<ReturnType<typeof pollVideoJob>> & Record<string, unknown>
      if (poll.status !== 'completed') return { jobId, status: poll.status, error: poll.error }
      const path = `${a.profileId}/bakeoff-video-${jobId.replace(/[^a-zA-Z0-9-]/g, '')}.mp4`
      const existing = await createPostAssetSignedUrl(path, 60 * 60 * 24)
      if (existing) return { jobId, status: 'completed', url: existing, usage: poll.usage ?? null }
      const src = poll.unsigned_urls?.[0]
      if (!src) return { jobId, status: 'failed', error: 'no_url' }
      const dl = await fetch(src, { headers: openRouterHeaders() })
      if (!dl.ok) return { jobId, status: 'failed', error: `download ${dl.status}` }
      const bytes = Buffer.from(await dl.arrayBuffer())
      const { error } = await a.supabase.storage.from(POST_ASSETS_BUCKET).upload(path, bytes, { contentType: 'video/mp4', upsert: true })
      if (error) return { jobId, status: 'failed', error: error.message }
      return { jobId, status: 'completed', url: await createPostAssetSignedUrl(path, 60 * 60 * 24), usage: poll.usage ?? null }
    } catch (err) {
      return { jobId, status: 'error', error: err instanceof Error ? err.message.slice(0, 200) : String(err) }
    }
  }))
  return NextResponse.json({ results })
}
