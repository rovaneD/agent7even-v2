-- Post image styles as data: each row is a proven creative recipe + the model that renders it best.
-- New style = new row (no deploy). Writer reads `recipe`; renderer reads `model` / `uses_logo`.
CREATE TABLE IF NOT EXISTS public.post_styles (
  id              text PRIMARY KEY,                 -- slug, e.g. 'brand_world'
  name            text NOT NULL,
  tagline         text NOT NULL,                    -- one line under the card in the picker
  recipe          text NOT NULL,                    -- art direction for the brief writer
  model           text NOT NULL,                    -- OpenRouter image model id
  fallback_model  text,
  uses_logo       boolean NOT NULL DEFAULT false,   -- pass the brand-kit logo as an image reference
  example_paths   text[] NOT NULL DEFAULT '{}',     -- post-assets storage paths for gallery cards
  sort_order      int NOT NULL DEFAULT 100,
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_styles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS post_styles_read_enabled ON public.post_styles;
CREATE POLICY post_styles_read_enabled ON public.post_styles
  FOR SELECT TO authenticated USING (enabled);
-- Writes: service role only (no insert/update/delete policies).

INSERT INTO public.post_styles (id, name, tagline, recipe, model, fallback_model, uses_logo, sort_order) VALUES
('brand_world', 'Brand world', 'Your brand on real objects, styled like a design studio shoot',
 'The brand identity lives on a real physical object from the customer''s world: a printed menu card on a café tray, a kraft takeout box with a line printed inside the lid, a thermal receipt, a shopping bag, a sticker, a coffee cup sleeve. The copy is printed ON the object in a distinctive typeface (condensed serif, monospace labels, hand lettering) — never laid over the photo. Studio still life or overhead flat lay, one hero object, deliberate soft directional light, one tight palette, tactile materials (paper, cardboard, steel, marble, ceramic), generous negative space. Feels like a design-studio brand identity shoot. The real logo appears small on the object.',
 'openai/gpt-image-2.5-flare', 'google/gemini-3-pro-image', true, 10),
('witty_object', 'Witty object', 'An everyday object that carries the joke',
 'One everyday object from the owner''s day tells the story with a twist the viewer completes: a handwritten to-do list, a receipt with one line circled, a flyer taped to a door, a sticky note on a register, a chalkboard sign. The writing on the object IS the copy — specific, a little funny, in the owner''s voice. Shot close, documentary style, real paper and handwriting texture, natural light of the actual workplace. Never illustrate the message literally with a person holding something.',
 'openai/gpt-image-2.5-flare', 'google/gemini-3-pro-image', true, 20),
('magazine_cover', 'Magazine cover', 'Bold editorial cover starring a real owner',
 'A cover of an invented independent local-business magazine. A real owner from this company''s customer base, in their own shop, looks straight at camera, lit with on-camera flash against a saturated wall color. A huge condensed masthead across the top with the subject overlapping it, one short bold cover line that carries the message, glossy editorial print design, punchy saturated color. Proud, specific, human.',
 'openai/gpt-image-2.5-flare', 'google/gemini-3-pro-image', false, 30),
('story_ugc', 'Story / UGC', 'Native phone-shot story with one caption',
 'Looks exactly like a real Instagram story frame posted by an owner: handheld front-camera selfie or quick phone shot in their real workplace, honest light, real clutter, slightly tilted, phone grain. One native story caption in a white rounded text box, lowercase, conversational, specific numbers from their day. The frame is the full-bleed photo with that single caption and nothing else around it.',
 'openai/gpt-image-2.5-flare', 'google/gemini-3-pro-image', false, 40),
('surreal_miniature', 'Surreal miniature', 'A playful scaled-down world that makes the point',
 'A surreal miniature photograph: an everyday object at giant scale placed in a tiny model world (a main street, a shop counter, a street corner) with figurine people interacting with it, so the metaphor reads in one second. Tilt-shift miniature look, soft studio light, pastel two-color palette, playful and clean. One bold rounded sans headline across the top.',
 'google/gemini-3-pro-image', 'openai/gpt-image-2.5-flare', false, 50)
ON CONFLICT (id) DO NOTHING;
