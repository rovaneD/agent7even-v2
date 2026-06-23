/** @deprecated Import from `@/lib/agents/contentPosting/platformFormats` instead. */
export {
  type ContentPlatform,
  type ImageFormatId,
  type VideoFormatId,
  type ImageFormatSpec,
  type VideoFormatSpec,
  type PlatformFormatSpec,
  IMAGE_POST_FORMATS as INSTAGRAM_IMAGE_FORMATS,
  VIDEO_POST_FORMATS as INSTAGRAM_VIDEO_FORMATS,
  DEFAULT_IMAGE_FORMAT as DEFAULT_INSTAGRAM_IMAGE_FORMAT,
  DEFAULT_VIDEO_FORMAT as DEFAULT_INSTAGRAM_VIDEO_FORMAT,
  isImageFormatId as isInstagramImageFormatId,
  isVideoFormatId as isInstagramVideoFormatId,
  resolveImageFormat as resolveInstagramImageFormat,
  resolveVideoFormat as resolveInstagramVideoFormat,
  platformUsernameFromCompany as instagramUsernameFromCompany,
  contentPostingFlowHref,
} from './platformFormats'

export type InstagramImageFormatId = import('./platformFormats').ImageFormatId
export type InstagramVideoFormatId = import('./platformFormats').VideoFormatId
export type InstagramFormatId = InstagramImageFormatId | InstagramVideoFormatId
export type InstagramAspectRatio = '4:5' | '9:16'
export type InstagramFormatSpec = import('./platformFormats').PlatformFormatSpec
