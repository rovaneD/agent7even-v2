-- Video skills as data (like post_styles): each row is a production recipe — writer direction,
-- model + fallback, clip length, credit tier, example clips. New skill = new row.
-- Code falls back to a built-in Creative concept skill until this runs, so order vs deploy is safe.
CREATE TABLE IF NOT EXISTS public.video_skills (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  tagline           text NOT NULL,
  recipe            text NOT NULL,
  model             text NOT NULL,                       -- OpenRouter video model id
  fallback_model    text,
  duration_seconds  int  NOT NULL DEFAULT 5,             -- Kling: 5 or 10 only
  credit_action     text NOT NULL DEFAULT 'video_standard'
                    CHECK (credit_action IN ('video_standard','video_premium')),
  example_paths     text[] NOT NULL DEFAULT '{}',        -- post-assets paths (mp4) for picker cards
  sort_order        int NOT NULL DEFAULT 100,
  enabled           boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS video_skills_read_enabled ON public.video_skills;
CREATE POLICY video_skills_read_enabled ON public.video_skills
  FOR SELECT TO authenticated USING (enabled);

INSERT INTO public.video_skills (id, name, tagline, recipe, model, fallback_model, duration_seconds, credit_action, example_paths, sort_order) VALUES
('creative_concept', 'Creative concept',
 'A short visual idea that makes the point — miniature worlds, paper craft, editorial portraits, witty objects',
 E'Pick the ONE look that carries this idea best:\n- Surreal miniature: a tilt-shift model world (main street, shop counter, street corner) with figurine people and one real everyday object at giant scale; soft studio light, pastel two-color palette, slow crane or push-in.\n- Paper craft stop-motion: cut-paper or cardboard pieces that fold, pop up and slide into place at 12 fps on a real surface (marble, kraft, wood); visible paper grain and cut edges, tight palette, handmade charm.\n- Editorial portrait: a real owner type from this customer base in their own workplace against a saturated painted wall, hard on-camera flash pops, quick punch-in zooms that freeze on each pop, ends on a proud expression.\n- Witty object: a locked-off close shot of the everyday objects of the owner''s day (receipts, sticky notes, tools, ingredients) that move by themselves to tell a tiny story with a twist; real textures, natural workplace light.\nThe motion itself is the punchline: something builds, transforms, clears, fills up or reveals. Real materials and textures, crisp detail, one tight palette.',
 'kwaivgi/kling-v3.0-pro', 'bytedance/seedance-2.5', 5, 'video_standard',
 ARRAY[
   'bfa73081-3906-4b5b-b24e-d9df3fb07384/bakeoff-video-gen-vid-1792290080-Dnt05wZrybFh8vVukSI6.mp4',
   'bfa73081-3906-4b5b-b24e-d9df3fb07384/bakeoff-video-gen-vid-1792290080-gQ44Cl3cwPa8ovVOcrKj.mp4',
   'bfa73081-3906-4b5b-b24e-d9df3fb07384/bakeoff-video-gen-vid-1792290080-z98ZWFX4YNpc0ymhCatY.mp4'
 ], 10)
ON CONFLICT (id) DO NOTHING;
