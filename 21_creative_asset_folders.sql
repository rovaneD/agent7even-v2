-- Asset folders for organizing saved creative generations
-- Run after 19_creative_assets.sql (and 20_creative_assets_extend.sql if used)

CREATE TABLE IF NOT EXISTS creative_asset_folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE creative_assets
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES creative_asset_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_creative_asset_folders_user
  ON creative_asset_folders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creative_assets_user_folder
  ON creative_assets (user_id, folder_id);
