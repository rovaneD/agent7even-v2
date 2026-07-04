'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, X } from 'lucide-react'
import PostImageAttach from '@/components/agents/PostImageAttach'
import PostImageGenerate from '@/components/agents/PostImageGenerate'
import PostImageGeneratePicker from '@/components/agents/PostImageGeneratePicker'
import PostImageEditPanel from '@/components/agents/PostImageEditPanel'
import PostImageTextQaPanel from '@/components/agents/PostImageTextQaPanel'
import PostVideoGenerate from '@/components/agents/PostVideoGenerate'
import {
  clearGenerationSession,
  loadGenerationSession,
  saveGenerationSession,
  type GenerationSession,
} from '@/lib/agents/imageGeneration/generationSessionStorage'
import { TEXT_QA_MAX_REGENERATE_RETRIES, type GeneratedImageOption, type TextQaResult } from '@/lib/agents/imageGeneration/types'
import { sanitizeUserFacingError } from '@/lib/agents/sanitizeProviderError'
import type { CreativeAssetWithUrl } from '@/lib/creativeAssets'
import { AGENTS } from '@/lib/agents/registry'
import type { ContentPostingFlow } from '@/lib/agents/contentPosting'
import {
  CONTENT_POSTING_FLOW_CONFIG,
  INITIAL_CONTENT_POSTING_FORMS,
  buildContentPostingInstructions,
  contentPostingModeToFlow,
  mergePostContextForm,
  contentPostingAgentName,
  type ContentPostingMode,
} from '@/lib/agents/contentPosting/uiConfig'
import {
  isImageFormatId,
  isVideoFormatId,
  resolveImageFormat,
  resolveVideoFormat,
  contentPostingModeHref,
} from '@/lib/agents/contentPosting/platformFormats'
import { cropPresetsForFormat } from '@/lib/posts/cropPresets'
import type { AttachedPostImage } from '@/components/agents/PostImageAttach'

interface Props {
  mode: ContentPostingMode
  profileId: string
  companyName: string
  brandKitAvailable?: boolean
  hasUploadedLogo?: boolean
  activeTasks: Array<{ id: string; agent: string; status: string; input: Record<string, unknown> }>
}

type RunTrackerPhase = 'generating' | 'done' | 'error'

interface RunTracker {
  taskId: string
  agent: string
  contentFlow?: ContentPostingFlow
  phase: RunTrackerPhase
  message: string
  detail?: string
  primaryHref?: string
  primaryLabel?: string
}

interface AgentTask {
  id: string
  agent: string
  status: string
  priority?: string
  input: Record<string, unknown>
  output?: Record<string, unknown>
  requires_approval?: boolean
  approved_at?: string | null
  rejected_at?: string | null
  error?: string | null
  created_at?: string
  started_at?: string | null
  completed_at?: string | null
}

const VIDEO_INTRO =
  'Set your post goal and scene direction. Maya writes a Creative Direction brief and generates your Instagram clip in the background.'

const CONSTRAINT_TEMPLATES = [
  { label: 'No discounting', text: 'Never offer discounts, promotions, or reduced pricing without explicit client approval.' },
  { label: 'No delivery promises', text: 'Never promise specific delivery timelines, turnaround times, or completion dates.' },
  { label: 'No competitor mentions', text: 'Never name or reference specific competitors by name.' },
  { label: 'Route pricing to human', text: 'Always direct pricing and cost questions to a human team member.' },
  { label: 'No guarantees', text: 'Never promise specific results, outcomes, rankings, or revenue figures.' },
  { label: 'No sensitive topics', text: 'Never engage with political, religious, or controversial social topics.' },
]

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function friendlyRunError(error: string | null | undefined): string {
  if (!error) return 'Agent run failed before producing output.'
  if (error.includes('Authentication Required') || error.includes('run-route error 401')) {
    return 'Agent run could not start on this deployment. Try again after the latest deploy finishes.'
  }
  if (error.includes('Unknown agent: content-posting')) {
    return 'Content Posting handler was not reachable on this deployment. Wait for the latest deploy, then try again.'
  }
  if (error.includes('INSUFFICIENT_CREDITS')) return 'Not enough credits to finish this run.'
  const match = error.match(/run-route error \d+: (.+)/)
  if (match) {
    try {
      const parsed = JSON.parse(match[1]) as { error?: string }
      if (parsed.error) return parsed.error
    } catch {
      /* use raw error below */
    }
  }
  return error.length > 180 ? `${error.slice(0, 180)}…` : error
}

function runTrackerGeneratingMessage(
  agent: string,
  contentFlow?: ContentPostingFlow,
  generatedCompose?: boolean,
): string {
  if (generatedCompose) {
    return 'Composing caption and submitting for approval…'
  }
  if (agent === 'content_posting' && contentFlow === 'single') {
    return 'Generating your post caption from your image…'
  }
  if (agent === 'content_posting' && contentFlow === 'weekly') {
    return 'Building your weekly content plan…'
  }
  return `Running ${contentPostingAgentName()}…`
}

function runTrackerDoneState(
  taskId: string,
  agent: string,
  contentFlow?: ContentPostingFlow,
  requiresApproval?: boolean,
): Pick<RunTracker, 'message' | 'detail' | 'primaryHref' | 'primaryLabel'> {
  if (agent === 'content_posting' && contentFlow === 'single') {
    return {
      message: 'Done — your caption is ready.',
      detail: 'It is in Approvals until you approve it. The Posts page only shows drafts after approval.',
      primaryHref: `/dashboard/agents/approvals?task=${taskId}&queue=post`,
      primaryLabel: 'Review in Approvals',
    }
  }
  if (requiresApproval) {
    return {
      message: 'Done — output ready for review.',
      detail: 'Open Approvals to approve or edit before it goes anywhere.',
      primaryHref: `/dashboard/agents/approvals?task=${taskId}`,
      primaryLabel: 'Review in Approvals',
    }
  }
  return {
    message: 'Done — run completed.',
    detail: 'Open the output archive to read the full result.',
    primaryHref: `/dashboard/agents/${agent}/outputs`,
    primaryLabel: 'View output',
  }
}

function ContentPostingRunStatusBanner({
  tracker,
  onDismiss,
}: {
  tracker: RunTracker
  onDismiss: () => void
}) {
  const isGenerating = tracker.phase === 'generating'
  const isDone = tracker.phase === 'done'
  const isError = tracker.phase === 'error'

  return (
    <div
      className={`mb-6 overflow-hidden rounded-2xl border shadow-sm ${
        isGenerating
          ? 'border-blue-100 bg-blue-50'
          : isDone
            ? 'border-emerald-100 bg-emerald-50'
            : 'border-red-100 bg-red-50'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-4 px-5 py-4">
        <div
          className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
            isGenerating
              ? 'bg-white text-brand-primary'
              : isDone
                ? 'bg-white text-emerald-600'
                : 'bg-white text-red-600'
          }`}
        >
          {isGenerating && <Loader2 size={20} className="animate-spin" />}
          {isDone && <CheckCircle2 size={20} />}
          {isError && <AlertCircle size={20} />}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-semibold ${
              isGenerating ? 'text-blue-900' : isDone ? 'text-emerald-900' : 'text-red-900'
            }`}
          >
            {tracker.message}
          </p>
          {tracker.detail && (
            <p
              className={`mt-1 text-[13px] leading-relaxed ${
                isGenerating ? 'text-blue-800/80' : isDone ? 'text-emerald-800/80' : 'text-red-800/80'
              }`}
            >
              {tracker.detail}
            </p>
          )}
          {isGenerating && (
            <p className="mt-2 text-[12px] text-blue-700/70">
              Usually 15–45 seconds. Stay on this page — we&apos;ll show a link when it&apos;s ready.
            </p>
          )}
          {isDone && tracker.primaryHref && tracker.primaryLabel && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link
                href={tracker.primaryHref}
                className="inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-[13px] font-semibold text-white no-underline transition-colors hover:bg-[#2563EB]"
              >
                {tracker.primaryLabel}
                <ArrowRight size={14} />
              </Link>
              {tracker.contentFlow === 'single' && (
                <Link
                  href="/dashboard/posts"
                  className="text-[13px] font-medium text-emerald-800 no-underline hover:underline"
                >
                  Posts (after you approve)
                </Link>
              )}
            </div>
          )}
        </div>

        {!isGenerating && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 rounded-lg p-1.5 text-text-soft hover:bg-black/5 hover:text-text-primary"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function ContentPostingFlowClient({
  mode,
  profileId,
  companyName,
  brandKitAvailable = false,
  hasUploadedLogo = false,
  activeTasks,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const useAssetId = searchParams.get('useAsset')
  const formatParam = searchParams.get('format')

  const contentPostingFlow = contentPostingModeToFlow(mode)
  const flowConfig = CONTENT_POSTING_FLOW_CONFIG[contentPostingFlow]
  const intro = mode === 'video' ? VIDEO_INTRO : flowConfig.intro

  const isImageMode = mode === 'image'
  const isVideoMode = mode === 'video'
  const showRunButton = !isVideoMode

  const selectedFormat = useMemo(() => {
    if (isImageMode) return resolveImageFormat(formatParam)
    if (isVideoMode) return resolveVideoFormat(formatParam)
    return null
  }, [isImageMode, isVideoMode, formatParam])

  const imageCropFormat = isImageMode && selectedFormat ? selectedFormat as import('@/lib/agents/contentPosting/platformFormats').ImageFormatSpec : null
  const imageGenerationEnabled = process.env.NEXT_PUBLIC_IMAGE_GENERATION === 'true'
  const videoGenerationEnabled = process.env.NEXT_PUBLIC_VIDEO_GENERATION === 'true'

  const runningVideoTask = activeTasks.find(
    t => t.agent === 'video_generation' && t.status === 'running',
  )

  const [contentPostingForms, setContentPostingForms] = useState(INITIAL_CONTENT_POSTING_FORMS)
  const [taskInstructions, setTaskInstructions] = useState('')
  const [taskPriority, setTaskPriority] = useState<'normal' | 'high'>('normal')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [runTracker, setRunTracker] = useState<RunTracker | null>(null)
  const [taskCreateError, setTaskCreateError] = useState<string | null>(null)
  const createTaskInFlightRef = useRef(false)

  const [postImageMedia, setPostImageMedia] = useState<AttachedPostImage | null>(null)
  const [postImageRequiredError, setPostImageRequiredError] = useState<string | null>(null)
  const [generatedImageOptions, setGeneratedImageOptions] = useState<GeneratedImageOption[]>([])
  const [generatedBriefId, setGeneratedBriefId] = useState<string | null>(null)
  const [generatedImageModelLabel, setGeneratedImageModelLabel] = useState<string | null>(null)
  const [selectedGeneratedIndex, setSelectedGeneratedIndex] = useState<number | null>(null)
  const [generatedTextQa, setGeneratedTextQa] = useState<TextQaResult | null>(null)
  const [generatedQaLoading, setGeneratedQaLoading] = useState(false)
  const [generatedQaRegenerating, setGeneratedQaRegenerating] = useState(false)
  const [qaRetryByIndex, setQaRetryByIndex] = useState<Record<number, number>>({})
  const [generatedImageEditing, setGeneratedImageEditing] = useState(false)
  const [sessionHydrated, setSessionHydrated] = useState(false)
  const [sessionRestored, setSessionRestored] = useState(false)

  const [videoJobId, setVideoJobId] = useState<string | null>(
    (runningVideoTask?.input?.video_job_id as string | undefined) ?? null,
  )
  const [videoTaskId, setVideoTaskId] = useState<string | null>(runningVideoTask?.id ?? null)
  const [videoModel, setVideoModel] = useState<string | null>(
    (runningVideoTask?.input?.video_model as string | undefined) ?? null,
  )

  const [constraints, setConstraints] = useState('')
  const [savedConstraints, setSavedConstraints] = useState('')
  const [isCustomized, setIsCustomized] = useState(false)
  const [constraintsLastUpdated, setConstraintsLastUpdated] = useState<string | null>(null)
  const [savingConstraints, setSavingConstraints] = useState(false)
  const [constraintsSaved, setConstraintsSaved] = useState(false)

  const selectedAgentForm = contentPostingForms[contentPostingFlow]

  const selectedGeneratedOption = useMemo(
    () => generatedImageOptions.find(o => o.index === selectedGeneratedIndex) ?? null,
    [generatedImageOptions, selectedGeneratedIndex],
  )

  const requiresGeneratedTextQa =
    imageGenerationEnabled && isImageMode && selectedGeneratedIndex != null

  const isGeneratedComposePath =
    requiresGeneratedTextQa && generatedTextQa?.passed === true

  function resetGenerationState() {
    setGeneratedImageOptions([])
    setGeneratedBriefId(null)
    setGeneratedImageModelLabel(null)
    setSelectedGeneratedIndex(null)
    setGeneratedTextQa(null)
    setGeneratedQaLoading(false)
    setGeneratedImageEditing(false)
    setQaRetryByIndex({})
    setPostImageMedia(null)
    setPostImageRequiredError(null)
    setSessionRestored(false)
  }

  function handleDiscardSession() {
    clearGenerationSession(profileId)
    resetGenerationState()
  }

  async function refreshOptionPreviews(
    options: Array<Omit<GeneratedImageOption, 'previewUrl'> & { previewUrl?: string | null }>,
  ): Promise<GeneratedImageOption[]> {
    const res = await fetch('/api/posts/generate-images/refresh-previews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePaths: options.map(o => o.storagePath) }),
    })
    const data = await res.json().catch(() => ({}))
    const previews = (data.previews ?? {}) as Record<string, string | null>
    return options.map(o => ({
      ...o,
      previewUrl: previews[o.storagePath] ?? o.previewUrl ?? null,
    }))
  }

  async function applyLoadedAsset(asset: CreativeAssetWithUrl) {
    setPostImageRequiredError(null)
    setTaskCreateError(null)

    if (asset.post_context) {
      setContentPostingForms(prev => ({
        ...prev,
        single: mergePostContextForm(prev.single, asset.post_context),
      }))
    }

    const index = asset.option_index ?? 0
    const brief = asset.brief ?? asset.brief_excerpt ?? ''
    const option: GeneratedImageOption = {
      index,
      brief,
      storagePath: asset.storage_path,
      mime: asset.mime,
      previewUrl: asset.preview_url,
      model: asset.image_model ?? 'google/gemini-2.5-flash-image',
    }

    setGeneratedBriefId(asset.brief_id ?? crypto.randomUUID())
    setGeneratedImageModelLabel(asset.image_model_label)
    setGeneratedImageOptions([option])
    setSelectedGeneratedIndex(index)
    setPostImageMedia({
      storagePath: option.storagePath,
      mime: option.mime,
      previewUrl: option.previewUrl ?? '',
      filename: 'saved-asset',
    })
    setQaRetryByIndex({})

    if (asset.qa_passed === true) {
      setGeneratedTextQa({
        passed: true,
        transcription: null,
        issues: [],
        qaMethod: 'vision_readback',
      })
    } else {
      setGeneratedTextQa(null)
      await runTextQaForOption(option)
    }
  }

  async function restoreGenerationSession(session: GenerationSession) {
    setContentPostingForms(prev => ({
      ...prev,
      single: session.contentPostingForm,
    }))
    setTaskInstructions(session.taskInstructions)
    setGeneratedBriefId(session.briefId)
    setGeneratedImageModelLabel(session.imageModelLabel)
    setSelectedGeneratedIndex(session.selectedIndex)
    setGeneratedTextQa(session.generatedTextQa)
    setQaRetryByIndex(session.qaRetryByIndex)

    const options = await refreshOptionPreviews(session.options)
    setGeneratedImageOptions(options)

    if (session.selectedIndex != null) {
      const opt = options.find(o => o.index === session.selectedIndex)
      if (opt) {
        setPostImageMedia({
          storagePath: opt.storagePath,
          mime: opt.mime,
          previewUrl: opt.previewUrl ?? '',
          filename: `generated-option-${opt.index + 1}`,
        })
      }
    } else {
      setPostImageMedia(null)
    }

    setSessionRestored(true)
  }

  async function runTextQaForOption(option: GeneratedImageOption) {
    setGeneratedQaLoading(true)
    setGeneratedTextQa(null)
    setPostImageRequiredError(null)
    try {
      const res = await fetch('/api/posts/generate-images/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storagePath: option.storagePath,
          brief: option.brief,
        }),
      })
      const data = await res.json().catch(() => ({}))
      const qa = data.qa as TextQaResult | undefined
      if (!qa) {
        const raw =
          (typeof data.message === 'string' ? data.message : null)
          ?? (typeof data.error === 'string' ? data.error : null)
          ?? 'Text QA could not run.'
        setPostImageRequiredError(sanitizeUserFacingError(raw, 'image_qa'))
        return
      }
      setGeneratedTextQa(qa)
      if (!qa.passed) {
        setPostImageRequiredError('Text QA failed. Regenerate this option or pick another image.')
      }
    } catch {
      setPostImageRequiredError('Text QA could not run. Try again.')
    } finally {
      setGeneratedQaLoading(false)
    }
  }

  async function handleRegenerateAfterQaFail() {
    const option = selectedGeneratedOption
    if (!option || !generatedBriefId || generatedQaRegenerating) return
    const retryCount = qaRetryByIndex[option.index] ?? 0
    if (retryCount >= TEXT_QA_MAX_REGENERATE_RETRIES) return

    setGeneratedQaRegenerating(true)
    setPostImageRequiredError(null)
    try {
      const res = await fetch('/api/posts/generate-images/regenerate-option', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId: generatedBriefId,
          optionIndex: option.index,
          brief: option.brief,
          retryCount,
          imageModel: option.model,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const raw =
          (typeof data.message === 'string' ? data.message : null)
          ?? (typeof data.error === 'string' ? data.error : null)
          ?? 'Regeneration failed.'
        setPostImageRequiredError(sanitizeUserFacingError(raw, 'image_regenerate'))
        return
      }
      const newOption = data.option as GeneratedImageOption
      setGeneratedImageOptions(prev =>
        prev.map(o => (o.index === newOption.index ? newOption : o)),
      )
      setQaRetryByIndex(prev => ({ ...prev, [option.index]: retryCount + 1 }))
      setPostImageMedia({
        storagePath: newOption.storagePath,
        mime: newOption.mime,
        previewUrl: newOption.previewUrl ?? '',
        filename: `generated-option-${newOption.index + 1}`,
      })
      await runTextQaForOption(newOption)
    } catch {
      setPostImageRequiredError('Regeneration failed. Try again.')
    } finally {
      setGeneratedQaRegenerating(false)
    }
  }

  async function handleEditImageOption(instruction: string, editMode: 'text-only' | 'visual') {
    const option = selectedGeneratedOption
    if (!option || !generatedBriefId || generatedImageEditing) {
      throw new Error('Select an image option first.')
    }

    setGeneratedImageEditing(true)
    setPostImageRequiredError(null)
    try {
      const res = await fetch('/api/posts/generate-images/edit-option', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId: generatedBriefId,
          optionIndex: option.index,
          brief: option.brief,
          editInstruction: instruction,
          imageModel: option.model,
          sourceStoragePath: option.storagePath,
          editMode,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const raw =
          (typeof data.message === 'string' ? data.message : null)
          ?? (typeof data.error === 'string' ? data.error : null)
          ?? 'Edit failed.'
        const msg = sanitizeUserFacingError(raw, 'image_edit')
        if (msg.toLowerCase().includes('image is too large')) {
          throw new Error('Image is too large to edit in-place. Try Fix text only mode or pick another option.')
        }
        throw new Error(msg)
      }
      const newOption = data.option as GeneratedImageOption
      setGeneratedImageOptions(prev =>
        prev.map(o => (o.index === newOption.index ? newOption : o)),
      )
      setPostImageMedia({
        storagePath: newOption.storagePath,
        mime: newOption.mime,
        previewUrl: newOption.previewUrl ?? '',
        filename: `generated-option-${newOption.index + 1}`,
      })
      setGeneratedTextQa(null)
      await runTextQaForOption(newOption)
    } finally {
      setGeneratedImageEditing(false)
    }
  }

  function updateContentPostingForm(key: string, value: string) {
    setContentPostingForms(prev => ({
      ...prev,
      [contentPostingFlow]: {
        ...prev[contentPostingFlow],
        [key]: value,
      },
    }))
  }

  useEffect(() => {
    if (mode === 'weekly') return
    const valid = isImageMode
      ? isImageFormatId(formatParam)
      : isVideoFormatId(formatParam)
    if (!valid) return

    const format = isImageMode
      ? resolveImageFormat(formatParam)
      : resolveVideoFormat(formatParam)
    setContentPostingForms(prev => ({
      ...prev,
      single: {
        ...prev.single,
        platform: format.platform,
        instagramFormat: formatParam ?? '',
        postFormat: formatParam ?? '',
      },
    }))
  }, [mode, isImageMode, isVideoMode, formatParam])

  useEffect(() => {
    if (!isImageMode || !imageGenerationEnabled || sessionHydrated) return

    async function hydrate() {
      try {
        if (useAssetId) {
          const res = await fetch(`/api/creative-assets/${useAssetId}`)
          const data = await res.json().catch(() => ({}))
          if (res.ok && data.asset) {
            await applyLoadedAsset(data.asset as CreativeAssetWithUrl)
            router.replace(
              formatParam
                ? `/dashboard/agents/content-posting/image?format=${formatParam}`
                : '/dashboard/agents/content-posting/image?format=ig-feed-post',
            )
          }
        } else {
          const session = loadGenerationSession(profileId)
          if (session) {
            await restoreGenerationSession(session)
          }
        }
      } finally {
        setSessionHydrated(true)
      }
    }

    void hydrate()
  }, [isImageMode, imageGenerationEnabled, sessionHydrated, useAssetId, profileId, router, formatParam])

  useEffect(() => {
    if (!isImageMode || !imageGenerationEnabled || !sessionHydrated) return
    if (generatedImageOptions.length === 0 || !generatedBriefId) return
    saveGenerationSession(profileId, {
      briefId: generatedBriefId,
      imageModelLabel: generatedImageModelLabel,
      options: generatedImageOptions,
      selectedIndex: selectedGeneratedIndex,
      generatedTextQa,
      qaRetryByIndex,
      contentPostingForm: contentPostingForms.single,
      taskInstructions,
    })
  }, [
    isImageMode,
    imageGenerationEnabled,
    sessionHydrated,
    profileId,
    generatedBriefId,
    generatedImageModelLabel,
    generatedImageOptions,
    selectedGeneratedIndex,
    generatedTextQa,
    qaRetryByIndex,
    contentPostingForms.single,
    taskInstructions,
  ])

  useEffect(() => {
    setConstraints('')
    setSavedConstraints('')
    setIsCustomized(false)
    setConstraintsLastUpdated(null)

    fetch('/api/agents/constraints?agentId=content_posting')
      .then(r => r.json())
      .then(data => {
        const value = data.constraints ?? ''
        setConstraints(value)
        setSavedConstraints(value)
        setIsCustomized(!!data.constraints)
        setConstraintsLastUpdated(data.updated_at ?? null)
      })
      .catch(() => {})
  }, [mode])

  async function handleSaveConstraints() {
    setSavingConstraints(true)
    try {
      await fetch('/api/agents/constraints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'content_posting', constraints }),
      })
      setSavedConstraints(constraints)
      setIsCustomized(true)
      setConstraintsLastUpdated(new Date().toISOString())
      setConstraintsSaved(true)
      setTimeout(() => setConstraintsSaved(false), 2500)
    } finally {
      setSavingConstraints(false)
    }
  }

  async function pollTaskRun(taskId: string, agent: string, contentFlow?: ContentPostingFlow) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      const res = await fetch(`/api/agents/tasks/${taskId}`)
      if (!res.ok) continue

      const data = await res.json().catch(() => ({}))
      const task = data.task as AgentTask | undefined
      if (!task) continue

      if (task.status === 'pending' || task.status === 'running') {
        setRunTracker(prev =>
          prev?.taskId === taskId
            ? {
                ...prev,
                phase: 'generating',
                message: runTrackerGeneratingMessage(agent, contentFlow),
                detail: undefined,
              }
            : prev,
        )
        continue
      }

      if (task.status === 'completed') {
        setRunTracker({
          taskId,
          agent,
          contentFlow,
          phase: 'done',
          ...runTrackerDoneState(taskId, agent, contentFlow, task.requires_approval),
        })
        return
      }

      if (task.status === 'failed') {
        setRunTracker({
          taskId,
          agent,
          contentFlow,
          phase: 'error',
          message: 'Run failed',
          detail: friendlyRunError(task.error),
        })
        return
      }
    }

    setRunTracker({
      taskId,
      agent,
      contentFlow,
      phase: 'error',
      message: 'Run is taking longer than expected',
      detail: 'Refresh the page in a moment, or check Live activity for failed runs.',
    })
  }

  async function handleCreateTask() {
    if (createTaskInFlightRef.current) return
    createTaskInFlightRef.current = true
    setPostImageRequiredError(null)
    setTaskCreateError(null)
    setSubmitting(true)
    try {
      const form = contentPostingForms[contentPostingFlow]
      const instructions = buildContentPostingInstructions(contentPostingFlow, form, taskInstructions)
      let input: Record<string, unknown> = { instructions, contentFlow: contentPostingFlow, ...form }

      if (contentPostingFlow === 'single') {
        if (!postImageMedia) {
          setPostImageRequiredError(
            imageGenerationEnabled
              ? 'Generate and pick an image, or upload one, before running Single post.'
              : 'Attach the post image before running Single post.',
          )
          return
        }

        if (selectedGeneratedIndex != null && imageGenerationEnabled) {
          if (generatedQaLoading) {
            setPostImageRequiredError('Text QA is still running. Wait a moment.')
            return
          }
          if (!generatedTextQa?.passed) {
            setPostImageRequiredError(
              'Pick a generated image that passes text QA, or upload your own.',
            )
            return
          }
          const option = selectedGeneratedOption
          if (!option || !generatedBriefId) {
            setPostImageRequiredError('Select a generated image option first.')
            return
          }

          setRunTracker({
            taskId: 'compose',
            agent: 'content_posting',
            contentFlow: 'single',
            phase: 'generating',
            message: runTrackerGeneratingMessage('content_posting', 'single', true),
          })

          const composeRes = await fetch('/api/posts/generate-images/compose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              briefId: generatedBriefId,
              optionIndex: option.index,
              brief: option.brief,
              storagePath: postImageMedia.storagePath,
              mime: postImageMedia.mime,
              imageModel: option.model,
              optionsCount: generatedImageOptions.length,
              qa: generatedTextQa,
              instructions,
              contentFlow: 'single',
              ...form,
              priority: taskPriority,
            }),
          })
          const composeData = await composeRes.json().catch(() => ({}))
          if (!composeRes.ok) {
            setRunTracker(null)
            const msg =
              (typeof composeData.message === 'string' ? composeData.message : null)
              ?? (typeof composeData.error === 'string' ? composeData.error : null)
              ?? 'Could not compose and queue this post.'
            setTaskCreateError(
              msg === 'INSUFFICIENT_CREDITS'
                ? 'Not enough credits for image generation (3 credits).'
                : msg,
            )
            return
          }

          const taskId = composeData.taskId as string
          clearGenerationSession(profileId)
          setSubmitted(true)
          setTaskInstructions('')
          resetGenerationState()
          setTimeout(() => setSubmitted(false), 3000)
          setRunTracker(null)
          router.push(`/dashboard/agents/approvals?task=${taskId}&queue=post`)
          return
        }

        input.media_storage_path = postImageMedia.storagePath
        input.media_mime = postImageMedia.mime
        input.image_caption_mode = true
        if (postImageMedia.mediaEdit) {
          input.media_edit = postImageMedia.mediaEdit
        }
        input.platforms = form.platform ?? 'Instagram'
      }

      const res = await fetch('/api/agents/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'content_posting',
          input,
          priority: taskPriority,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTaskCreateError(typeof data.error === 'string' ? data.error : 'Could not queue this agent run.')
        return
      }

      const queuedFlow = contentPostingFlow
      setSubmitted(true)
      setTaskInstructions('')
      resetGenerationState()
      setTimeout(() => setSubmitted(false), 3000)

      if (typeof data.taskId === 'string') {
        setRunTracker({
          taskId: data.taskId,
          agent: 'content_posting',
          contentFlow: queuedFlow,
          phase: 'generating',
          message: runTrackerGeneratingMessage('content_posting', queuedFlow),
        })
        void pollTaskRun(data.taskId, 'content_posting', queuedFlow)
      }
    } finally {
      createTaskInFlightRef.current = false
      setSubmitting(false)
    }
  }

  const controlClass =
    'w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand-primary'

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6">
      {runTracker && (
        <ContentPostingRunStatusBanner
          tracker={runTracker}
          onDismiss={() => setRunTracker(null)}
        />
      )}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-menu-muted">Setup</p>
          <h2 className="mt-1 text-[18px] font-semibold text-text-primary">{contentPostingAgentName()}</h2>
        </div>
        {submitted && (
          <span className="rounded-full bg-status-success/10 px-3 py-1.5 text-xs font-semibold text-status-success">
            Task queued
          </span>
        )}
        {runTracker?.phase === 'generating' && (
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            <Loader2 size={12} className="animate-spin" />
            Generating…
          </span>
        )}
      </div>

      <div className="mb-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-sm font-semibold text-text-primary">{contentPostingAgentName()} setup</p>
        <p className="mt-1 text-sm leading-6 text-text-sec">
          {isImageMode && selectedFormat
            ? `Create a ${selectedFormat.placement.toLowerCase()} (${selectedFormat.dimensions}). ${flowConfig.intro}`
            : isVideoMode && selectedFormat
              ? `Create ${selectedFormat.placement} (${selectedFormat.dimensions}). ${VIDEO_INTRO}`
              : intro}
        </p>
      </div>

      {(isImageMode || isVideoMode) && selectedFormat && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
              {selectedFormat.platform} · {selectedFormat.aspectRatio}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-text-primary">
              {selectedFormat.label} · {selectedFormat.dimensions}
            </p>
          </div>
          <Link
            href={contentPostingModeHref(isImageMode ? 'image' : 'video')}
            className="text-xs font-semibold text-brand-primary hover:underline"
          >
            Change format
          </Link>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-6">
        {flowConfig.fields
          .filter(field => !((isImageMode || isVideoMode) && field.key === 'platform'))
          .map(field => {
          const type = field.type ?? 'text'
          const columnSpan = field.columns === 1 ? 6 : field.columns === 3 ? 2 : 3
          const spanClass =
            columnSpan === 6 ? 'sm:col-span-6' : columnSpan === 2 ? 'sm:col-span-2' : 'sm:col-span-3'

          return (
            <label key={field.key} className={`grid gap-1.5 ${spanClass}`}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
                {field.label}
              </span>
              {type === 'select' ? (
                <select
                  value={selectedAgentForm[field.key] ?? ''}
                  onChange={e => updateContentPostingForm(field.key, e.target.value)}
                  className={controlClass}
                >
                  {(field.options ?? []).map(option => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : type === 'textarea' ? (
                <textarea
                  value={selectedAgentForm[field.key] ?? ''}
                  onChange={e => updateContentPostingForm(field.key, e.target.value)}
                  rows={field.columns === 1 ? 4 : 3}
                  placeholder={field.placeholder}
                  className={`${controlClass} resize-y leading-6`}
                />
              ) : (
                <input
                  value={selectedAgentForm[field.key] ?? ''}
                  onChange={e => updateContentPostingForm(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={controlClass}
                />
              )}
            </label>
          )
        })}
      </div>

      <label className="mb-4 grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
          Additional instructions
        </span>
        <textarea
          value={taskInstructions}
          onChange={e => setTaskInstructions(e.target.value)}
          placeholder={`Optional: add anything specific ${contentPostingAgentName()} should know for this run.`}
          rows={3}
          className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-sm leading-6 text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand-primary"
        />
      </label>

      {isImageMode && (
        <div className="mb-4 space-y-4">
          {imageGenerationEnabled && (
            <>
              {sessionRestored && generatedImageOptions.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-3 py-2">
                  <p className="text-xs text-text-sec">
                    Your last generation session was restored. Pick up where you left off or discard it.
                  </p>
                  <button
                    type="button"
                    onClick={handleDiscardSession}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-text-sec hover:border-gray-300"
                  >
                    Discard session
                  </button>
                </div>
              )}
              <PostImageGenerate
                disabled={submitting}
                sceneDirection={taskInstructions}
                postContext={contentPostingForms.single}
                brandKitAvailable={brandKitAvailable}
                hasUploadedLogo={hasUploadedLogo}
                aspectRatio={selectedFormat?.generationAspectRatio ?? '4:5'}
                onOptionsReady={({ briefId, options, imageModelLabel }) => {
                  setSessionRestored(false)
                  setGeneratedBriefId(briefId)
                  setGeneratedImageModelLabel(imageModelLabel ?? null)
                  setGeneratedImageOptions(options)
                  setSelectedGeneratedIndex(null)
                  setPostImageMedia(null)
                  setPostImageRequiredError(null)
                  setGeneratedTextQa(null)
                  setGeneratedQaLoading(false)
                  setQaRetryByIndex({})
                }}
              />
              <PostImageGeneratePicker
                key={generatedBriefId ?? 'no-brief'}
                options={generatedImageOptions}
                selectedIndex={selectedGeneratedIndex}
                briefId={generatedBriefId}
                imageModelLabel={generatedImageModelLabel}
                postContext={contentPostingForms.single}
                qaPassed={generatedTextQa?.passed === true}
                disabled={
                  submitting
                  || generatedQaLoading
                  || generatedQaRegenerating
                  || generatedImageEditing
                }
                onSelect={option => {
                  setSelectedGeneratedIndex(option.index)
                  setPostImageRequiredError(null)
                  setGeneratedTextQa(null)
                  setPostImageMedia({
                    storagePath: option.storagePath,
                    mime: option.mime,
                    previewUrl: option.previewUrl ?? '',
                    filename: `generated-option-${option.index + 1}`,
                  })
                  void runTextQaForOption(option)
                }}
              />
              {selectedGeneratedOption && generatedBriefId && (
                <PostImageEditPanel
                  option={selectedGeneratedOption}
                  disabled={submitting}
                  editing={generatedImageEditing}
                  onEdit={handleEditImageOption}
                />
              )}
              <PostImageTextQaPanel
                qa={generatedTextQa}
                loading={generatedQaLoading}
                retryCount={
                  selectedGeneratedOption ? (qaRetryByIndex[selectedGeneratedOption.index] ?? 0) : 0
                }
                maxRetries={TEXT_QA_MAX_REGENERATE_RETRIES}
                selectedOption={selectedGeneratedOption}
                onRegenerate={() => void handleRegenerateAfterQaFail()}
                regenerating={generatedQaRegenerating}
              />
              <p className="text-center text-xs text-text-soft">or upload your own image</p>
            </>
          )}
          <PostImageAttach
            disabled={submitting}
            cropPresets={cropPresetsForFormat(imageCropFormat)}
            defaultCropPresetId={imageCropFormat?.id}
            attached={
              postImageMedia
                ? {
                    previewUrl: postImageMedia.previewUrl,
                    filename: postImageMedia.filename,
                    storagePath: postImageMedia.storagePath,
                    mime: postImageMedia.mime,
                  }
                : null
            }
            onAttached={media => {
              setPostImageRequiredError(null)
              setPostImageMedia(media)
              setSelectedGeneratedIndex(null)
              setGeneratedTextQa(null)
              setGeneratedQaLoading(false)
            }}
            onClear={() => {
              setPostImageMedia(null)
              setSelectedGeneratedIndex(null)
              setGeneratedTextQa(null)
              setGeneratedQaLoading(false)
            }}
          />
          {postImageRequiredError && (
            <p className="text-sm text-red-600">{postImageRequiredError}</p>
          )}
        </div>
      )}

      {isVideoMode && (
        <div className="mb-4">
          {videoGenerationEnabled ? (
            <PostVideoGenerate
              disabled={submitting}
              postContext={contentPostingForms.single}
              sceneDirection={taskInstructions}
              initialPending={
                videoJobId
                  ? { jobId: videoJobId, taskId: videoTaskId ?? '', model: videoModel ?? '' }
                  : undefined
              }
              onJobStarted={({ jobId, taskId, model }) => {
                setVideoJobId(jobId)
                setVideoTaskId(taskId)
                setVideoModel(model)
              }}
            />
          ) : (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-6 text-center">
              <p className="text-sm font-medium text-text-primary">Video generation is not enabled</p>
              <p className="mt-1 text-xs text-text-sec">
                Video generation is coming soon on this workspace. Check back after your admin enables it.
              </p>
            </div>
          )}
        </div>
      )}

      {showRunButton && (
        <div className="flex flex-wrap items-center gap-3">
          {taskCreateError && (
            <p className="w-full text-sm text-red-600">{taskCreateError}</p>
          )}
          <div className="flex gap-2">
            {(['normal', 'high'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setTaskPriority(p)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  taskPriority === p
                    ? 'border border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border border-border bg-surface-2 text-text-sec hover:border-border-strong'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleCreateTask()}
            disabled={
              submitting
              || submitted
              || runTracker?.phase === 'generating'
              || generatedImageEditing
              || (isImageMode && !postImageMedia)
              || (requiresGeneratedTextQa && (generatedQaLoading || !generatedTextQa?.passed))
            }
            className={`ml-auto min-w-[180px] rounded-xl px-5 py-3 text-sm font-semibold text-text-inverse transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              submitted ? 'bg-status-success' : 'bg-brand-primary hover:bg-[#2563EB]'
            }`}
          >
            {runTracker?.phase === 'generating'
              ? isGeneratedComposePath
                ? 'Composing…'
                : 'Generating…'
              : submitted
                ? isGeneratedComposePath
                  ? 'Submitted'
                  : 'Task queued'
                : submitting
                  ? isGeneratedComposePath
                    ? 'Composing…'
                    : 'Queuing...'
                  : isGeneratedComposePath
                    ? 'Submit for approval'
                    : `Run ${AGENTS.content_posting.name}`}
          </button>
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-menu-muted">
              What this agent will never do
            </p>
            <p className="mt-1 text-xs text-text-sec">Brand safety guardrails applied to every run.</p>
          </div>
          {isCustomized && (
            <span className="flex-shrink-0 rounded-full bg-status-success/10 px-2.5 py-1 text-xs font-semibold text-status-success">
              Customized
            </span>
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {CONSTRAINT_TEMPLATES.map(t => (
            <button
              key={t.label}
              type="button"
              onClick={() => setConstraints(prev => (prev ? `${prev}\n${t.text}` : t.text))}
              className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-sec transition-colors hover:border-gray-200 hover:text-text-primary"
            >
              + {t.label}
            </button>
          ))}
        </div>

        <textarea
          value={constraints}
          onChange={e => setConstraints(e.target.value)}
          rows={4}
          placeholder={AGENTS.content_posting.defaultConstraints}
          className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm leading-6 text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand-primary"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {constraints !== savedConstraints && (
            <button
              type="button"
              onClick={() => void handleSaveConstraints()}
              disabled={savingConstraints}
              className="rounded-xl bg-brand-primary px-4 py-2 text-xs font-semibold text-text-inverse transition-colors hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingConstraints ? 'Saving…' : 'Save constraints'}
            </button>
          )}
          {constraintsSaved && (
            <span className="text-xs font-medium text-status-success">Constraints saved</span>
          )}
          {constraintsLastUpdated && !constraintsSaved && (
            <span className="text-xs text-text-muted">
              Last updated {relativeTime(constraintsLastUpdated)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
