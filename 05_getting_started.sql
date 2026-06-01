-- Add getting_started_dismissed flag to profiles
-- Run in Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS getting_started_dismissed boolean DEFAULT false;
