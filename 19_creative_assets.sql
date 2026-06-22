-- Creative generation asset library (saved options from image generation runs)
-- Run in Supabase SQL Editor. Files stay in post-assets bucket; this table indexes metadata.

CREATE TABLE IF NOT EXISTS creative_assets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path      text NOT NULL,
  mime              text NOT NULL DEFAULT 'image/png',
  asset_type        text NOT NULL DEFAULT 'image',
  source            text NOT NULL DEFAULT 'generation',
  brief_id          uuid,
  option_index      integer,
  image_model       text,
  image_model_label text,
  brief_excerpt     text,
  post_context      jsonb,
  is_favorite       boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_creative_assets_user_created
  ON creative_assets (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creative_assets_user_favorite
  ON creative_assets (user_id, is_favorite)
  WHERE is_favorite = true;
