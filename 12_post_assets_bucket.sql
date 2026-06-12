-- Post images for caption-in-context loop (private bucket, profile-scoped paths).
-- Run manually in Supabase SQL editor. Bucket may also be created lazily via API.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-assets',
  'post-assets',
  false,
  20971520,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS: service role used by API routes; optional policy for authenticated read own prefix.
-- Path convention: post-assets/{profile_id}/{uuid}-{filename}
