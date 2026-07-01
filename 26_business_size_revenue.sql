-- Migration: business size + annual revenue buckets on profiles
-- Run in Supabase SQL editor (Dashboard > SQL editor)
-- Safe to run multiple times — uses ADD COLUMN IF NOT EXISTS

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS employee_count_bucket text,
  ADD COLUMN IF NOT EXISTS annual_revenue_bucket text;

COMMENT ON COLUMN profiles.employee_count_bucket IS 'Team size bucket, e.g. 1-10, 11-20';
COMMENT ON COLUMN profiles.annual_revenue_bucket IS 'Annual revenue bucket, e.g. under-100k, 100k-500k';
