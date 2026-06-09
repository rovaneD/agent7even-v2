-- Migration: add zernio_profile_ids text array to profiles
-- Run in Supabase SQL editor (Dashboard > SQL editor)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS zernio_profile_ids text[] DEFAULT '{}'::text[];

-- Backfill existing single profile ID into the array if it's currently empty
UPDATE profiles
SET zernio_profile_ids = ARRAY[zernio_profile_id]
WHERE zernio_profile_id IS NOT NULL 
  AND (zernio_profile_ids IS NULL OR cardinality(zernio_profile_ids) = 0);
