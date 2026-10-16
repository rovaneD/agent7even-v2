export type GeneratedImageOption = {
  index: number
  brief: string
  storagePath: string
  mime: string
  previewUrl: string | null
  model: string
}

export type GenerateImageOptionsResult = {
  briefId: string
  briefModel: string
  imageModel: string
  imageModelId?: string
  imageModelLabel?: string
  options: GeneratedImageOption[]
  /** Writer's concept per option (message, headline, visual idea, prompt) — for debugging output quality. */
  concepts?: { style_id: string; message: string; headline: string; visual_idea: string; prompt: string }[]
  /** The writer's raw idea seeds before the critic pass. */
  ideas?: string[]
  styleMode?: 'fixed' | 'auto'
  costInstrumentation?: {
    actionType: string
    optionCount: number
    briefCostUsd: number
    imageCallsCostUsd: number
    totalCostUsd: number
    inputTokens: number
    outputTokens: number
  }
}

export type TextQaIssue = {
  code: string
  message: string
}

export type TextQaResult = {
  passed: boolean
  transcription: string | null
  lines?: string[]
  issues: TextQaIssue[]
  qaMethod: 'vision_readback'
}

/** Max single-option regenerations after QA fail (handoff §2c). */
export const TEXT_QA_MAX_REGENERATE_RETRIES = 2

/** Max auto-regenerations per option when QA fails during initial generation. */
/** QA retries re-render the writer's scene with targeted fixes — never a text-only fallback. */
export const GENERATION_OPTION_QA_MAX_RETRIES = 2

export type GeneratedImageOptionWithQa = GeneratedImageOption & {
  qa?: TextQaResult | null
}
