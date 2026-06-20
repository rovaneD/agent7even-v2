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

export type GeneratedImageOptionWithQa = GeneratedImageOption & {
  qa?: TextQaResult | null
}
