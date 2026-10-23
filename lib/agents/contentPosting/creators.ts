/**
 * Creators: the presenters for presenter-type videos. Owner direction 2026-10-21: young, attractive,
 * real-looking (pamba.app style), 12 in our cast. Each creator is one locked photo (face + their own
 * room); every video of that creator starts from the same photo, so the face never drifts.
 * Recipe and test results: project doc claude/creators_library.md.
 */

export interface CastCreator {
  id: string
  name: string
  gender: 'woman' | 'man'
  age: number
  /** Short description shown on hover / in the sheet. */
  look: string
  /** post-assets storage path of the locked photo (2:3, 1024×1536). */
  photoPath: string
  /**
   * post-assets path of the creator's voice sample (an ElevenLabs Voice Design preview the owner picked
   * by ear, 2026-10-23). Speech is made by copying this sample (Fish Audio Drama 3 via OpenRouter).
   */
  voiceSamplePath: string
}

const CAST_DIR = 'bfa73081-3906-4b5b-b24e-d9df3fb07384'

export const CAST_CREATORS: CastCreator[] = [
  { id: 'rory', name: 'Rory', gender: 'woman', age: 24, look: 'Copper curls, black tee, apartment', photoPath: `${CAST_DIR}/7134b380-0aef-4fc9-beb6-ad5fdac1c24a-bakeoff-1792645998415-p1-openai_gpt-image-2.5-flare.png`, voiceSamplePath: `${CAST_DIR}/voice-1792652997814-design-1.mp3` },
  { id: 'june', name: 'June', gender: 'woman', age: 23, look: 'Black bob, yellow knit, bright bedroom', photoPath: `${CAST_DIR}/edc0c34b-cd65-4700-b955-25ad2365865c-bakeoff-1792645998415-p2-openai_gpt-image-2.5-flare.png`, voiceSamplePath: `${CAST_DIR}/voice-1792653007118-design-1.mp3` },
  { id: 'kai', name: 'Kai', gender: 'man', age: 25, look: 'Long dark curls, striped shirt, minimal apartment', photoPath: `${CAST_DIR}/50d86416-9158-4aa7-b4e4-524255d5256d-bakeoff-1792645998415-p3-openai_gpt-image-2.5-flare.png`, voiceSamplePath: `${CAST_DIR}/voice-1792653015463-design-1.mp3` },
  { id: 'leo', name: 'Leo', gender: 'man', age: 22, look: 'Tousled hair, taupe hoodie, studio apartment', photoPath: `${CAST_DIR}/d8b0a6e3-1a6a-461a-82bd-87a54bf93241-bakeoff-1792645998415-p4-openai_gpt-image-2.5-flare.png`, voiceSamplePath: `${CAST_DIR}/voice-1792653024913-design-3.mp3` },
  { id: 'elena', name: 'Elena', gender: 'woman', age: 24, look: 'Long dark waves, grey sweatshirt, bedroom', photoPath: `${CAST_DIR}/a718fc27-9a4c-43b1-a3b5-687a72e8089f-bakeoff-1792646015748-p1-openai_gpt-image-2.5-flare.png`, voiceSamplePath: `${CAST_DIR}/voice-1792653034085-design-1.mp3` },
  { id: 'amara', name: 'Amara', gender: 'woman', age: 26, look: 'Braids, rust tee, bright kitchen', photoPath: `${CAST_DIR}/c6109414-6ddc-462c-a2ff-5aa5cd321a77-bakeoff-1792646015748-p2-openai_gpt-image-2.5-flare.png`, voiceSamplePath: `${CAST_DIR}/voice-1792653699068-design-3.mp3` },
  { id: 'cole', name: 'Cole', gender: 'man', age: 27, look: 'Sandy hair, green sweater, living room', photoPath: `${CAST_DIR}/9823209b-96e4-4317-802b-c50c127dc764-bakeoff-1792646015748-p3-openai_gpt-image-2.5-flare.png`, voiceSamplePath: `${CAST_DIR}/voice-1792653052094-design-3.mp3` },
  { id: 'priya', name: 'Priya', gender: 'woman', age: 23, look: 'Lavender cardigan, café window', photoPath: `${CAST_DIR}/effe2620-b514-49d5-b868-54bd9a5f2297-bakeoff-1792646015748-p4-openai_gpt-image-2.5-flare.png`, voiceSamplePath: `${CAST_DIR}/voice-1792653061323-design-1.mp3` },
  { id: 'theo', name: 'Theo', gender: 'man', age: 27, look: 'Charcoal tee, home studio', photoPath: `${CAST_DIR}/bae80588-d3ea-4aa3-a4e0-a056d5651492-bakeoff-1792620185626-p1-openai_gpt-image-2.5-flare.png`, voiceSamplePath: `${CAST_DIR}/voice-1792649293374-design-1.mp3` },
  { id: 'nora', name: 'Nora', gender: 'woman', age: 26, look: 'Blonde bob, white shirt, balcony', photoPath: `${CAST_DIR}/95f05b78-831b-4e75-8cc3-a0062f065769-bakeoff-1792646591173-p1-openai_gpt-image-2.5-flare.png`, voiceSamplePath: `${CAST_DIR}/voice-1792653071502-design-1.mp3` },
  { id: 'jalen', name: 'Jalen', gender: 'man', age: 25, look: 'Twists, denim overshirt, record shelf', photoPath: `${CAST_DIR}/5797bcda-284e-45a2-8a4e-656d3b3942eb-bakeoff-1792647708359-p1-openai_gpt-image-2.5-flare.png`, voiceSamplePath: `${CAST_DIR}/voice-1792653708997-design-3.mp3` },
  { id: 'layla', name: 'Layla', gender: 'woman', age: 27, look: 'Long dark hair, beige knit, kitchen', photoPath: `${CAST_DIR}/10e8660a-fe69-429b-8c1c-d869641d8e2d-bakeoff-1792646591173-p3-openai_gpt-image-2.5-flare.png`, voiceSamplePath: `${CAST_DIR}/voice-1792653090970-design-3.mp3` },
]

export function castCreatorById(id: string | null | undefined): CastCreator | null {
  return CAST_CREATORS.find(c => c.id === id) ?? null
}

/** "Create your own" picks. Every option maps to prompt text below; nothing free-form reaches the model. */
export const CREATOR_TRAITS = {
  gender: ['Woman', 'Man'],
  age: ['20–24', '25–29', '30–35'],
  skin: ['Fair', 'Light olive', 'Tan', 'Brown', 'Deep brown'],
  hair: ['Short', 'Wavy', 'Curly', 'Long straight', 'Braids', 'Bob'],
  wear: ['Tee', 'Hoodie', 'Knit sweater', 'Button-up shirt', 'Sweatshirt'],
  room: ['Bedroom', 'Living room', 'Kitchen', 'Home studio', 'Café', 'Balcony'],
} as const

export type CreatorTraits = { [K in keyof typeof CREATOR_TRAITS]: (typeof CREATOR_TRAITS)[K][number] }

export const DEFAULT_CREATOR_TRAITS: CreatorTraits = {
  gender: 'Woman',
  age: '25–29',
  skin: 'Light olive',
  hair: 'Wavy',
  wear: 'Knit sweater',
  room: 'Living room',
}

export function isCreatorTraits(v: unknown): v is CreatorTraits {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (Object.keys(CREATOR_TRAITS) as (keyof typeof CREATOR_TRAITS)[]).every(k =>
    (CREATOR_TRAITS[k] as readonly string[]).includes(String(o[k])),
  )
}

const AGE_TEXT: Record<CreatorTraits['age'], string> = { '20–24': '22-year-old', '25–29': '27-year-old', '30–35': '32-year-old' }
const SKIN_TEXT: Record<CreatorTraits['skin'], string> = {
  Fair: 'Fair skin with a warm undertone and a few freckles',
  'Light olive': 'Light olive skin with a neutral undertone',
  Tan: 'Light tan skin with a warm undertone and faint freckles',
  Brown: 'Medium-brown skin with a golden undertone',
  'Deep brown': 'Deep brown skin with a warm undertone',
}
const HAIR_TEXT: Record<CreatorTraits['hair'], string> = {
  Short: 'Short hair, slightly messy on top, a few strands out of place',
  Wavy: 'Shoulder-length wavy hair with a few flyaways',
  Curly: 'Voluminous natural curls, a few falling forward',
  'Long straight': 'Long straight hair, center part, a few loose strands',
  Braids: 'Shoulder-length braids, a few loose at the front',
  Bob: 'Chin-length bob with soft waves',
}
const WEAR_TEXT: Record<CreatorTraits['wear'], string> = {
  Tee: 'a plain crew-neck tee in a soft muted color',
  Hoodie: 'a soft heather hoodie',
  'Knit sweater': 'a ribbed knit sweater in a warm neutral',
  'Button-up shirt': 'a light striped button-up shirt, top button open',
  Sweatshirt: 'a soft heather-grey crewneck sweatshirt',
}
const ROOM_TEXT: Record<CreatorTraits['room'], { room: string; light: string; palette: string }> = {
  Bedroom: { room: 'a cozy bedroom with white bedding, a framed print and a plant behind them', light: 'Soft morning daylight from a window on the left', palette: 'white, blush, warm wood' },
  'Living room': { room: 'a lived-in living room with a linen sofa, a floor lamp and a bookshelf softly behind them', light: 'Soft daylight from a window off-camera left plus a warm lamp glow', palette: 'cream, tan, sage, warm wood' },
  Kitchen: { room: 'a bright kitchen with white tiles, an open wooden shelf with jars and a plant behind them', light: 'Warm afternoon sun from a window on the right', palette: 'white, honey wood, green' },
  'Home studio': { room: 'a small home studio with a light oak shelf, a trailing pothos and a framed abstract print behind them', light: 'Soft daylight from the left plus a warm desk-lamp glow', palette: 'oak, cream, sage, charcoal' },
  Café: { room: 'a small café table by a window with a coffee cup and plants blurred behind them', light: 'Bright window daylight from the side', palette: 'cream, sage, warm wood' },
  Balcony: { room: 'a small sunny balcony with potted herbs and string lights behind them', light: 'Late-afternoon golden sun from the right', palette: 'white, sage, warm gold' },
}

/** Creator photo prompt (template v2, see claude/creators_library.md). */
export function buildCreatorPrompt(t: CreatorTraits): string {
  const who = `a ${AGE_TEXT[t.age]} ${t.gender === 'Man' ? 'man' : 'woman'}`
  const r = ROOM_TEXT[t.room]
  return `A real iPhone front-camera selfie video frame of ${who} holding the phone at arm's length at eye level, looking straight into the lens mid-sentence with a relaxed, friendly, natural face. Naturally attractive, camera-friendly, the kind of person who posts on TikTok every day. ${SKIN_TEXT[t.skin]}, natural skin texture with visible pores and faint freckles or small imperfections, no makeup look or very light everyday makeup. ${HAIR_TEXT[t.hair]}. Wears ${WEAR_TEXT[t.wear]}, modest everyday fit. Framed tight: head and shoulders fill the frame, face in the upper half, slight natural selfie angle. Room: ${r.room}. ${r.light}, natural and slightly uneven. Background slightly soft as in any phone photo, face in clear focus. Color palette: ${r.palette}. Shot on iPhone front camera, casual and real. Phone-sensor grain and realistic skin preserved, no retouch, no smooth-skin filter, no beauty filter, no studio lighting, no ring light, no color grading, no AI-aesthetic styling, no posed model energy. No visible text, logos or brand names anywhere. No fisheye, no ultra-wide distortion. Authentic UGC creator video frame, NOT editorial portrait, NOT fashion magazine.`
}

/** Credits for one "Create your own" run: two photo options at the standard image price each. */
export const CREATOR_OPTIONS_COUNT = 2
