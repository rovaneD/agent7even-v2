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
type FoundationDoc = { type: string; markdown?: string | null }

export type BrandKitSectionKey =
  | 'identity'
  | 'colors'
  | 'typography'
  | 'imagery'
  | 'voice'
  | 'templates'

const BRAND_KIT_TAB_LABELS: Record<BrandKitSectionKey, string> = {
  identity: 'Identity',
  colors: 'Colors',
  typography: 'Typography',
  imagery: 'Imagery',
  voice: 'Voice',
  templates: 'Templates',
}

const FOUNDATION_DOC_LABELS: Record<string, string> = {
  voice: 'Brand Voice Guide',
  brief: 'Business Brief',
  icp: 'Ideal Customer Profile',
  positioning: 'Positioning Statement',
}

function docStatus(doc: FoundationDoc | undefined): string {
  return doc?.markdown?.trim() ? 'generated' : 'not yet generated'
}

function buildBrandKitTabState(
  section: BrandKitSectionKey,
  input: {
    colors: BrandColor[]
    fonts: BrandFont[]
    assetCount: number
    identityAssetCount: number
    imageryAssetCount: number
    templateAssetCount: number
    documents: FoundationDoc[]
    sectionCompleted: boolean
  },
): string {
  switch (section) {
    case 'identity': {
      const logos = input.identityAssetCount
      return logos > 0
        ? `${logos} logo/mark asset(s) uploaded${input.sectionCompleted ? ', section marked complete' : ''}`
        : 'No logo assets uploaded yet'
    }
    case 'colors': {
      if (input.colors.length === 0) return 'Palette: not set'
      const swatches = input.colors
        .map(c => `${c.role} ${c.name?.trim() ? c.name : c.hex} (${c.hex})`.trim())
        .join('; ')
      return `Palette locked: ${swatches}`
    }
    case 'typography': {
      const chosen = input.fonts.filter(f => f.family?.trim())
      if (chosen.length === 0) return 'Fonts: not set'
      return `Fonts chosen: ${chosen.map(f => `${f.role} ${f.family}`).join('; ')}`
    }
    case 'imagery': {
      const parts = [`${input.imageryAssetCount} imagery asset(s)`]
      const moodDoc = input.documents.find(d => d.type === 'imagery')
      if (moodDoc) parts.push(`imagery doc ${docStatus(moodDoc)}`)
      return parts.join('; ')
    }
    case 'voice': {
      const foundationLines = (['voice', 'brief', 'icp', 'positioning'] as const).map(type => {
        const doc = input.documents.find(d => d.type === type)
        const label = FOUNDATION_DOC_LABELS[type] ?? type
        return `${label}: ${docStatus(doc)}`
      })
      return foundationLines.join('; ')
    }
    case 'templates': {
      return input.templateAssetCount > 0
        ? `${input.templateAssetCount} template link(s) saved`
        : 'No template links saved yet'
    }
  }
}

export function buildBrandKitEditorMayaContext(input: {
  companyName: string
  activeSection: BrandKitSectionKey
  sectionCompleted: boolean
  completedCount: number
  colors: BrandColor[]
  fonts: BrandFont[]
  assetCount: number
  identityAssetCount: number
  imageryAssetCount: number
  templateAssetCount: number
  documents: FoundationDoc[]
}): MayaPageContext {
  const colorCtx = input.colors.length
    ? input.colors.map(c => `${c.name ?? ''} ${c.hex} (${c.role})`.trim()).join(', ')
    : 'not set'
  const fontCtx = input.fonts.length
    ? input.fonts.map(f => `${f.family} (${f.role})`).join(', ')
    : 'not set'

  const tabState = buildBrandKitTabState(input.activeSection, input)

  return {
    page: 'BRAND KIT PAGE',
    dataSource: 'live',
    company: input.companyName,
    activeView: {
      label: BRAND_KIT_TAB_LABELS[input.activeSection],
      state: tabState,
    },
    metrics: [
      `Sections complete: ${input.completedCount}/6`,
      `Colors: ${colorCtx}`,
      `Typography: ${fontCtx}`,
      `Assets: ${input.assetCount > 0 ? `${input.assetCount} uploaded` : 'none'}`,
      `Voice documents: ${input.documents.some(d => d.type === 'voice' && d.markdown?.trim()) ? 'Brand Voice Guide generated' : 'not generated'}`,
    ],
    affordance: `${MAYA_VOICE_RULE} User is editing brand identity sections (colors, fonts, assets, voice). Lead with the CURRENTLY VIEWING tab before page-level summary.`,
  }
}
