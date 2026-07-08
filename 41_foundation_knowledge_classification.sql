-- Foundation V2 Piece 2 — purpose/classification on knowledge uploads
-- Run in Supabase SQL editor.

ALTER TABLE public.foundation_knowledge
  ADD COLUMN IF NOT EXISTS source_purpose text,
  ADD COLUMN IF NOT EXISTS purpose_confidence text,
  ADD COLUMN IF NOT EXISTS purpose_reason text;

COMMENT ON COLUMN public.foundation_knowledge.source_purpose IS
  'own_business | competitor | market_reference | customer_voice | unknown';

COMMENT ON COLUMN public.foundation_knowledge.purpose_confidence IS
  'high | medium | low — classifier confidence for source_purpose';

CREATE INDEX IF NOT EXISTS foundation_knowledge_source_purpose_idx
  ON public.foundation_knowledge (profile_id, source_purpose);
