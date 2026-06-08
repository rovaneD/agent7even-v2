-- Migration: add Zernio integration columns to profiles
-- Run in Supabase SQL editor (Dashboard > SQL editor)
-- Safe to run multiple times — uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS zernio_profile_id       text,
  ADD COLUMN IF NOT EXISTS zernio_connected_platforms jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS zernio_connected_at      timestamptz;

-- analytics_briefings table (for future Phase 6 briefing generation)
CREATE TABLE IF NOT EXISTS analytics_briefings (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id            uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  briefing_text         text NOT NULL,
  signals               jsonb,
  sources_used          text[],
  time_range            text NOT NULL,
  ga_snapshot           jsonb,
  zernio_social_snapshot jsonb,
  zernio_ads_snapshot   jsonb,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_briefings_profile_created
  ON analytics_briefings(profile_id, created_at DESC);

-- RLS for analytics_briefings: users can only read their own briefings
ALTER TABLE analytics_briefings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analytics_briefings' AND policyname = 'Users can read own briefings'
  ) THEN
    CREATE POLICY "Users can read own briefings"
      ON analytics_briefings FOR SELECT
      USING (
        profile_id IN (
          SELECT id FROM profiles WHERE clerk_user_id = auth.jwt() ->> 'sub'
        )
      );
  END IF;
END $$;
