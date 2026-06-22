import type { MayaPageContext } from '@/lib/maya/contextTypes'
import { MAYA_NO_FAKE_ACTIONS, MAYA_VOICE_RULE } from '@/lib/maya/voiceRules'

export function buildAssetsMayaContext(input: {
  companyName: string
  assetCount: number
  folderCount: number
}): MayaPageContext {
  return {
    page: 'ASSETS PAGE',
    dataSource: 'live',
    company: input.companyName,
    metrics: [
      `Saved creative assets: ${input.assetCount}`,
      `Folders: ${input.folderCount}`,
    ],
    affordance: `${MAYA_VOICE_RULE} ${MAYA_NO_FAKE_ACTIONS} User saves generated images here, organizes folders, previews, downloads, and "Use for post" opens Agents with that image. To run Content Posting: Agents → Content Posting → Single post (not from this chat). To generate new images: Agents → Single post → Generate with Maya.`,
  }
}
