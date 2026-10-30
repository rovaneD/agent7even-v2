/**
 * Video Post gallery: the six video types for this phase (owner decision 2026-10-20).
 * Each type is a skill: a fixed production recipe with 1–3 inputs; everything else comes
 * from Foundation and sensible defaults. See project doc claude/video_creation_flow_spec.md.
 *
 * `exampleUrl` stays null until we have made our own example clip for that type on the
 * Agent7even demo account — the gallery shows an "example in production" poster until then.
 */

export type VideoTypeId =
  | 'presenter_tip'
  | 'cinematic_broll'
  | 'product_showcase'
  | 'editorial_explainer'
  | 'animated_post'
  | 'shorts_maker'
  | 'brandkit'

export type VideoTypeField =
  | { key: string; kind: 'text'; label: string; placeholder: string; required?: boolean }
  | { key: string; kind: 'textarea'; label: string; placeholder: string; required?: boolean }
  | { key: string; kind: 'choice'; label: string; options: string[]; default: string }
  | { key: string; kind: 'multi'; label: string; options: string[]; default: string[]; max?: number }

export type CaptionChoice = 'off' | 'serif' | 'sans'

export interface VideoTypeSpec {
  id: VideoTypeId
  name: string
  /** One line under the name in the create panel. */
  tagline: string
  /** Short tag on the gallery tile. */
  tag: string
  /** Uses a saved, locked presenter (talking head). */
  presenter: boolean
  fields: VideoTypeField[]
  lengths: number[]
  defaultLength: number
  captionsDefault: CaptionChoice
  /** Rough wall-clock time for a finished video, shown in the panel footer. */
  minutes: number
  /** Poster gradient for tiles without an example clip yet. */
  poster: [string, string]
  exampleUrl: string | null
  /** post-assets path of our own example clip (signed by GET /api/posts/video-types). */
  examplePath?: string
  /** Creator shown in the example clip (labelled so it isn't mistaken for the user's pick). */
  exampleCreator?: string
  /** What the plan step will show, so the user knows before pressing it. */
  planPreview: string
}

export const VIDEO_TYPES: VideoTypeSpec[] = [
  {
    id: 'presenter_tip',
    name: 'Presenter tip',
    tagline: 'Your presenter teaches one useful tip in a few clear steps.',
    tag: 'Presenter',
    presenter: true,
    fields: [
      {
        key: 'topic',
        kind: 'text',
        label: "What's the tip about?",
        placeholder: 'One line — e.g. How to get a review after every job',
        required: true,
      },
    ],
    lengths: [15, 30],
    defaultLength: 15,
    captionsDefault: 'serif',
    minutes: 10,
    poster: ['#3a2a22', '#14100d'],
    exampleUrl: null,
    // Example #1 (2026-10-24): Theo, job-photo tip, made through Approve & create; owner: "looks fine".
    examplePath: 'bfa73081-3906-4b5b-b24e-d9df3fb07384/assembled-gen-vid-1792857572-pcvQuru6lQrfQ5Al1Ivv-1792861331016.mp4',
    exampleCreator: 'Theo',
    planPreview: 'Script line by line and where each card appears.',
  },
  {
    id: 'cinematic_broll',
    name: 'Cinematic B-roll',
    tagline: 'Your creator talks to camera, with cinematic shots of them in new places between the lines.',
    tag: 'Presenter',
    presenter: true,
    fields: [
      {
        key: 'topic',
        kind: 'text',
        label: 'What should they talk about?',
        placeholder: 'One line — e.g. How I plan a week of posts in one hour',
        required: true,
      },
      {
        key: 'settings',
        kind: 'textarea',
        label: 'Where should it be filmed? (optional)',
        placeholder: 'e.g. a rooftop, a café window seat, a home office. Leave empty and Maya picks a mix.',
      },
      {
        key: 'coverage',
        kind: 'choice',
        label: 'B-roll',
        options: ['One place, many angles', 'New places'],
        default: 'One place, many angles',
      },
      {
        key: 'outfit',
        kind: 'text',
        label: 'Outfit (optional)',
        placeholder: "Leave empty to keep the creator's own look",
      },
    ],
    lengths: [15, 30],
    defaultLength: 30,
    captionsDefault: 'sans',
    minutes: 12,
    poster: ['#22303a', '#0b1116'],
    exampleUrl: null,
    // Test 2 (2026-10-24), June, owner: "way better".
    examplePath: 'bfa73081-3906-4b5b-b24e-d9df3fb07384/assembled-gen-vid-1792883467-QG8Ee9aaTTDGEuqfuXFe-1792883715266.mp4',
    exampleCreator: 'June',
    planPreview: 'Script, which lines are on camera, and each B-roll shot.',
  },
  {
    id: 'product_showcase',
    name: 'Product showcase',
    tagline: 'Your presenter walks through your product or website with real screens.',
    tag: 'Presenter',
    presenter: true,
    fields: [
      {
        key: 'url',
        kind: 'text',
        label: 'Product or page',
        placeholder: 'https://yourwebsite.com/page',
        required: true,
      },
      {
        key: 'angle',
        kind: 'text',
        label: 'What should people take away?',
        placeholder: 'One line — e.g. Booking takes under a minute',
        required: true,
      },
    ],
    lengths: [15, 30],
    defaultLength: 30,
    captionsDefault: 'serif',
    minutes: 10,
    poster: ['#1d2a44', '#0b1020'],
    exampleUrl: null,
    planPreview: 'Script and which screen shows on which line.',
  },
  {
    id: 'editorial_explainer',
    name: 'Editorial explainer',
    tagline: 'A faceless explainer in three scenes with narration and subtitles.',
    tag: 'Faceless',
    presenter: false,
    fields: [
      {
        key: 'topic',
        kind: 'text',
        label: 'What should it explain?',
        placeholder: 'One line — e.g. Why reviews matter more than ads',
        required: true,
      },
      {
        key: 'style',
        kind: 'choice',
        label: 'Style',
        options: ['Cutouts & labels', 'Clean motion graphics', 'Illustrated'],
        default: 'Cutouts & labels',
      },
    ],
    lengths: [15, 30],
    defaultLength: 15,
    captionsDefault: 'serif',
    minutes: 6,
    poster: ['#3b1f1f', '#140a0a'],
    exampleUrl: null,
    planPreview: 'Narration and the three scenes.',
  },
  {
    id: 'animated_post',
    name: 'Animated post',
    tagline: 'One of your approved image posts, brought to life with its headline.',
    tag: 'From a post',
    presenter: false,
    fields: [
      {
        key: 'post',
        kind: 'text',
        label: 'Which post?',
        placeholder: 'Paste the headline of an approved image post',
        required: true,
      },
    ],
    lengths: [5, 10],
    defaultLength: 5,
    captionsDefault: 'off',
    minutes: 3,
    poster: ['#1f3330', '#0a1412'],
    exampleUrl: null,
    planPreview: 'The motion and the headline timing.',
  },
  {
    id: 'shorts_maker',
    name: 'Viral posts',
    tagline: 'Upload a longer video — Maya finds the strongest moments and cuts vertical shorts.',
    tag: 'Shorts maker',
    presenter: false,
    fields: [
      {
        key: 'source',
        kind: 'text',
        label: 'Your video',
        placeholder: 'Link to a 2–10 min video (YouTube, Drive, Dropbox)',
        required: true,
      },
      {
        key: 'count',
        kind: 'choice',
        label: 'How many shorts?',
        options: ['3', '5'],
        default: '3',
      },
    ],
    lengths: [30, 60],
    defaultLength: 30,
    captionsDefault: 'serif',
    minutes: 10,
    poster: ['#2b2140', '#0e0a18'],
    exampleUrl: null,
    planPreview: 'The moments Maya picks and each hook line.',
  },
  {
    id: 'brandkit',
    name: 'Brandkit',
    tagline: 'Your real logo and colors on everyday objects in an editorial brand reveal.',
    tag: 'Brand',
    presenter: false,
    fields: [
      {
        key: 'objects',
        kind: 'multi',
        label: 'Show it on',
        options: ['Tote bag', 'T-shirt', 'Business card', 'Coffee cup', 'Shop sign', 'Packaging'],
        default: ['Tote bag', 'Business card', 'Coffee cup'],
        max: 4,
      },
      {
        key: 'line',
        kind: 'text',
        label: 'One line to end on (optional)',
        placeholder: 'e.g. Fresh every morning since 2012',
      },
    ],
    lengths: [10, 15],
    defaultLength: 10,
    captionsDefault: 'off',
    minutes: 5,
    poster: ['#40211f', '#170b0a'],
    exampleUrl: null,
    planPreview: 'Each object shot in order and the end card.',
  },
]

export function videoTypeById(id: string | null | undefined): VideoTypeSpec | null {
  return VIDEO_TYPES.find(t => t.id === id) ?? null
}
