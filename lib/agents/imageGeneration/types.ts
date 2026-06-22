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
export const GENERATION_OPTION_QA_MAX_RETRIES = 1

export type GeneratedImageOptionWithQa = GeneratedImageOption & {
  qa?: TextQaResult | null
}
