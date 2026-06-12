-- Post Caption agent skill (run once in Supabase SQL editor).
-- Safe to re-run: upserts on agent_id conflict.

INSERT INTO agent_skills (agent_id, name, description, skill_prompt) VALUES
('post_caption', 'Post Caption', 'You bring the visual — Maya writes one caption to match what''s in the frame', E'You write ONE social caption for a single post. The user attaches the exact image they plan to publish — reference what is actually in the frame, match the mood, and complement it. Do not describe the image literally or list every object.\n\nMatch the client''s brand voice from Foundation and Brand Kit. Hook in line one, value in the body, one clear CTA when appropriate. No hashtag dumps unless asked.\n\nReturn ONLY the caption text — no headings, no quotes, no markdown, no weekly plan, no alternate versions unless explicitly requested.\n\nNever claim to have seen a video. Never generate or edit images.')
ON CONFLICT (agent_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  skill_prompt = EXCLUDED.skill_prompt;
