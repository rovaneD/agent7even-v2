-- Foundation Knowledge — uploaded materials that enrich Foundation context
-- Run in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.foundation_knowledge (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type       text        NOT NULL,  -- 'pdf' | 'docx' | 'image' | 'url' | 'text'
  source_name       text,                  -- filename or URL
  raw_content       text,                  -- extracted text (not the binary file)
  extraction_result jsonb,                 -- ExtractionResult from /api/foundation/ingest
  confirmed_fields  jsonb,                 -- items the owner confirmed
  storage_path      text,                  -- Supabase Storage path (files only)
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE public.foundation_knowledge ENABLE ROW LEVEL SECURITY;

-- Only service_role accesses this table (all routes use createServiceClient)
-- No direct anon/authenticated access needed.

CREATE INDEX IF NOT EXISTS foundation_knowledge_profile_id_idx
  ON public.foundation_knowledge (profile_id);

-- Track count on profiles for quick UI display
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS foundation_knowledge_count int DEFAULT 0;
