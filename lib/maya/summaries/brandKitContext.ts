import type { MayaPageContext } from '@/lib/maya/contextTypes'
import { MAYA_VOICE_RULE } from '@/lib/maya/voiceRules'

type BrandDoc = { title: string; type: string; version?: number | string }

export function buildBrandKitDocumentsMayaContext(input: {
  companyName: string
  answersComplete: boolean
  documents: BrandDoc[]
  generating?: boolean
}): MayaPageContext {
  const docLines = input.documents.length
    ? input.documents.map(d => `${d.title} (${d.type}, v${d.version ?? 1})`).join('; ')
    : 'none generated yet'
  const status = !input.answersComplete
    ? 'Questionnaire incomplete — user must finish before generating documents.'
    : 'Questionnaire complete — user can view and edit brand documents.'
  return {
    page: 'BRAND KIT PAGE',
    dataSource: 'live',
    company: input.companyName,
    metrics: [
      `Brand questionnaire complete: ${input.answersComplete ? 'yes' : 'no'}`,
      `Documents (${input.documents.length}): ${docLines}`,
      input.generating ? 'Documents are currently generating.' : status,
    ],
    affordance: `${MAYA_VOICE_RULE} Help with brand questionnaire answers and generated brand documents.`,
  }
}

type BrandColor = { name?: string | null; hex: string; role: string }
type BrandFont = { family: string; role: string }

export function buildBrandKitEditorMayaContext(input: {
  completedCount: number
  colors: BrandColor[]
  fonts: BrandFont[]
  assetCount: number
  documentTypes: string[]
}): MayaPageContext {
  const colorCtx = input.colors.length
    ? input.colors.map(c => `${c.name ?? ''} ${c.hex} (${c.role})`.trim()).join(', ')
    : 'not set'
  const fontCtx = input.fonts.length
    ? input.fonts.map(f => `${f.family} (${f.role})`).join(', ')
    : 'not set'
  return {
    page: 'BRAND KIT PAGE',
    dataSource: 'live',
    activeView: 'editor',
    metrics: [
      `Sections complete: ${input.completedCount}/6`,
      `Colors: ${colorCtx}`,
      `Typography: ${fontCtx}`,
      `Assets: ${input.assetCount > 0 ? `${input.assetCount} uploaded` : 'none'}`,
      `Voice documents: ${input.documentTypes.length ? input.documentTypes.join(', ') : 'not generated'}`,
    ],
    affordance: `${MAYA_VOICE_RULE} User is editing brand identity sections (colors, fonts, assets, voice).`,
  }
}
