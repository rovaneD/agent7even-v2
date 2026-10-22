-- Creators: a saved presenter for presenter-type videos (Presenter tip, Product showcase).
-- One locked photo (face + their own room) and, later, a real voice. Our cast of 12 lives in code
-- (lib/agents/contentPosting/creators.ts); this table holds each workspace's own creators.
-- Code treats a missing table as "no saved creators", so order vs deploy is safe.
CREATE TABLE IF NOT EXISTS public.video_creators (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,  -- workspace profile id
  name        text NOT NULL,
  traits      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- picks from "Create your own"
  photo_path  text NOT NULL,                         -- post-assets path of the locked photo
  voice_path  text,                                  -- post-assets path of the creator's voice (later)
  archived    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_creators_user_idx ON public.video_creators (user_id, created_at DESC);

-- Server routes use the service role; no client access.
ALTER TABLE public.video_creators ENABLE ROW LEVEL SECURITY;
