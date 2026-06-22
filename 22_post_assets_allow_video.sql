-- 22_post_assets_allow_video.sql
-- Add video/mp4 to the post-assets bucket allowed MIME types.
-- Run in Supabase SQL editor (or via MCP apply_migration).
-- Required for video generation to store generated videos in the same bucket as images.

UPDATE storage.buckets
SET allowed_mime_types = array(
  SELECT DISTINCT unnest(COALESCE(allowed_mime_types, ARRAY[]::text[]) || ARRAY['video/mp4'])
)
WHERE id = 'post-assets'
  AND NOT ('video/mp4' = ANY(COALESCE(allowed_mime_types, ARRAY[]::text[])));
