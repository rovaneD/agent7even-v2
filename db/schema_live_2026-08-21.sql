-- GENERATED FROM information_schema, not pg_dump
-- Snapshot date: 2026-08-21
-- Source: PostgREST OpenAPI introspection, not pg_dump

-- maya_sessions indexes (live-confirmed 2026-08-22 — do not create or drop):
CREATE UNIQUE INDEX maya_sessions_pkey ON public.maya_sessions USING btree (id);
CREATE INDEX maya_sessions_user_id_idx ON public.maya_sessions USING btree (user_id);
CREATE INDEX idx_maya_sessions_user_updated ON public.maya_sessions USING btree (user_id, updated_at DESC);

-- ── add_ons ──
CREATE TABLE IF NOT EXISTS public.add_ons (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  service text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  stripe_subscription_id text,
  stripe_price_id text,
  start_date date,
  renewal_date date,
  created_at text DEFAULT 'now()'
);

-- ── admin_email_log ──
CREATE TABLE IF NOT EXISTS public.admin_email_log (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  admin_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  subject text NOT NULL,
  body text NOT NULL,
  sent_at text DEFAULT 'now()'
);

-- ── admin_notes ──
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  admin_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  body text NOT NULL,
  created_at text DEFAULT 'now()'
);

-- ── agent_constraints ──
CREATE TABLE IF NOT EXISTS public.agent_constraints (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  agent_id text NOT NULL,
  constraints text NOT NULL,
  updated_at text DEFAULT 'now()'
);

-- ── agent_outputs ──
CREATE TABLE IF NOT EXISTS public.agent_outputs (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  task_id uuid -- Note: This is a Foreign Key to `agent_tasks.id`.<fk table='agent_tasks' column='id'/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  agent text NOT NULL,
  output_type text NOT NULL,
  title text,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval',
  approved_at text,
  created_at text DEFAULT 'now()',
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  cost_usd numeric DEFAULT 0,
  feedback text,
  feedback_note text,
  feedback_at text,
  media_storage_path text,
  media_mime text,
  lifecycle_stage text,
  zernio_post_id text,
  actor_profile_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>
);

-- ── agent_schedules ──
CREATE TABLE IF NOT EXISTS public.agent_schedules (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  agent text NOT NULL,
  frequency text NOT NULL DEFAULT 'weekly',
  day_of_week integer DEFAULT 1,
  hour_of_day integer DEFAULT 8,
  is_active boolean DEFAULT true,
  last_run_at text,
  next_run_at text,
  config text,
  created_at text DEFAULT 'now()'
);

-- ── agent_skills ──
CREATE TABLE IF NOT EXISTS public.agent_skills (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  agent_id text NOT NULL,
  name text NOT NULL,
  description text,
  skill_prompt text NOT NULL,
  handoff_to jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at text DEFAULT 'now()',
  updated_at text DEFAULT 'now()'
);

-- ── agent_tasks ──
CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  agent text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'normal',
  input text,
  output text,
  error text,
  requires_approval boolean DEFAULT false,
  approved_at text,
  rejected_at text,
  rejection_note text,
  scheduled_for text,
  started_at text,
  completed_at text,
  created_at text DEFAULT 'now()',
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  cost_usd numeric DEFAULT 0,
  model text,
  orchestration_id uuid -- Note: This is a Foreign Key to `orchestration_sessions.id`.<fk table='orchestration_sessions' column='id'/>,
  updated_at text DEFAULT 'now()',
  cached_tokens integer NOT NULL DEFAULT 0,
  job_type text,
  rejection_reason text,
  reviewed_at text,
  reviewed_by uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  assigned_to_profile_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  assigned_by_profile_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  assignment_note text,
  assignment_due_at text,
  actor_profile_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>
);

-- ── ai_tool_usage ──
CREATE TABLE IF NOT EXISTS public.ai_tool_usage (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  tool text NOT NULL,
  prompt_id uuid -- Note: This is a Foreign Key to `prompt_library.id`.<fk table='prompt_library' column='id'/>,
  input_summary text,
  output_length integer,
  time_saved_mins integer DEFAULT 15,
  created_at text DEFAULT 'now()'
);

-- ── analytics_briefings ──
CREATE TABLE IF NOT EXISTS public.analytics_briefings (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  profile_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  briefing_text text NOT NULL,
  signals text,
  sources_used jsonb,
  time_range text NOT NULL,
  ga_snapshot text,
  zernio_social_snapshot text,
  zernio_ads_snapshot text,
  created_at text DEFAULT 'now()'
);

-- ── anon_events ──
CREATE TABLE IF NOT EXISTS public.anon_events (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  event text NOT NULL,
  path text NOT NULL,
  variant text,
  created_at text NOT NULL DEFAULT 'now()'
);

-- ── approval_task_notes ──
CREATE TABLE IF NOT EXISTS public.approval_task_notes (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  task_id uuid NOT NULL -- Note: This is a Foreign Key to `agent_tasks.id`.<fk table='agent_tasks' column='id'/>,
  workspace_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  author_profile_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  body text NOT NULL,
  note_kind text NOT NULL DEFAULT 'comment',
  created_at text NOT NULL DEFAULT 'now()'
);

-- ── automation_logs ──
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  trigger_id uuid -- Note: This is a Foreign Key to `automation_triggers.id`.<fk table='automation_triggers' column='id'/>,
  status text NOT NULL,
  payload text,
  error_message text,
  created_at text DEFAULT 'now()'
);

-- ── automation_triggers ──
CREATE TABLE IF NOT EXISTS public.automation_triggers (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  name text NOT NULL,
  trigger_event text NOT NULL,
  action_type text NOT NULL,
  config text,
  is_active boolean DEFAULT true,
  run_count integer DEFAULT 0,
  last_run_at text,
  created_at text DEFAULT 'now()'
);

-- ── brand_answers ──
CREATE TABLE IF NOT EXISTS public.brand_answers (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  answers text NOT NULL,
  completed boolean DEFAULT false,
  created_at text DEFAULT 'now()',
  updated_at text DEFAULT 'now()'
);

-- ── brand_document_versions ──
CREATE TABLE IF NOT EXISTS public.brand_document_versions (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  document_id uuid -- Note: This is a Foreign Key to `brand_documents.id`.<fk table='brand_documents' column='id'/>,
  content text NOT NULL,
  version integer NOT NULL,
  created_at text DEFAULT 'now()'
);

-- ── brand_documents ──
CREATE TABLE IF NOT EXISTS public.brand_documents (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  version integer DEFAULT 1,
  created_at text DEFAULT 'now()',
  updated_at text DEFAULT 'now()'
);

-- ── brand_kit_assets ──
CREATE TABLE IF NOT EXISTS public.brand_kit_assets (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  section_key text NOT NULL,
  asset_type text NOT NULL,
  name text NOT NULL,
  file_url text,
  external_url text,
  thumbnail_url text,
  metadata text,
  sort_order integer DEFAULT 0,
  created_at text DEFAULT 'now()'
);

-- ── brand_kit_colors ──
CREATE TABLE IF NOT EXISTS public.brand_kit_colors (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  role text NOT NULL,
  name text,
  hex text NOT NULL,
  rgb text,
  notes text,
  sort_order integer DEFAULT 0,
  created_at text DEFAULT 'now()'
);

-- ── brand_kit_fonts ──
CREATE TABLE IF NOT EXISTS public.brand_kit_fonts (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  role text NOT NULL,
  family text NOT NULL,
  weight text,
  size_guide text,
  source_url text,
  notes text,
  created_at text DEFAULT 'now()'
);

-- ── brand_kit_sections ──
CREATE TABLE IF NOT EXISTS public.brand_kit_sections (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  section_key text NOT NULL,
  completed boolean DEFAULT false,
  updated_at text DEFAULT 'now()'
);

-- ── campaigns ──
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  title text,
  plan text,
  status text DEFAULT 'active',
  created_at text DEFAULT 'now()',
  updated_at text DEFAULT 'now()',
  tasks text,
  model_used text
);

-- ── chat_sessions ──
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  messages text,
  mode text,
  created_at text DEFAULT 'now()',
  updated_at text DEFAULT 'now()'
);

-- ── client_activity_log ──
CREATE TABLE IF NOT EXISTS public.client_activity_log (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  event_type text NOT NULL,
  metadata text,
  created_at text DEFAULT 'now()',
  workspace_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>
);

-- ── conversations ──
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  created_at text DEFAULT 'timezone('utc'::text, now())',
  session_id text NOT NULL,
  messages text NOT NULL,
  lead_qualified boolean DEFAULT false,
  visitor_summary text
);

-- ── creative_asset_folders ──
CREATE TABLE IF NOT EXISTS public.creative_asset_folders (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  name text NOT NULL,
  created_at text NOT NULL DEFAULT 'now()'
);

-- ── creative_assets ──
CREATE TABLE IF NOT EXISTS public.creative_assets (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  storage_path text NOT NULL,
  mime text NOT NULL DEFAULT 'image/png',
  asset_type text NOT NULL DEFAULT 'image',
  source text NOT NULL DEFAULT 'generation',
  brief_id uuid,
  option_index integer,
  image_model text,
  image_model_label text,
  brief_excerpt text,
  post_context text,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at text NOT NULL DEFAULT 'now()',
  brief text,
  qa_passed boolean,
  folder_id uuid -- Note: This is a Foreign Key to `creative_asset_folders.id`.<fk table='creative_asset_folders' column='id'/>
);

-- ── credit_balances ──
CREATE TABLE IF NOT EXISTS public.credit_balances (
  user_id uuid NOT NULL -- Note: This is a Primary Key.<pk/> This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  balance integer NOT NULL DEFAULT 0,
  lifetime_used integer NOT NULL DEFAULT 0,
  updated_at text DEFAULT 'now()'
);

-- ── credit_ledger ──
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  type text NOT NULL,
  credits integer NOT NULL,
  balance_after integer NOT NULL,
  description text,
  task_id uuid -- Note: This is a Foreign Key to `agent_tasks.id`.<fk table='agent_tasks' column='id'/>,
  orchestration_id uuid -- Note: This is a Foreign Key to `orchestration_sessions.id`.<fk table='orchestration_sessions' column='id'/>,
  created_at text DEFAULT 'now()'
);

-- ── credit_topups ──
CREATE TABLE IF NOT EXISTS public.credit_topups (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  stripe_session_id text NOT NULL,
  stripe_payment_id text,
  credits integer NOT NULL,
  amount_usd numeric NOT NULL,
  status text DEFAULT 'pending',
  created_at text DEFAULT 'now()',
  completed_at text
);

-- ── daily_digests ──
CREATE TABLE IF NOT EXISTS public.daily_digests (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  date date NOT NULL,
  agent_runs text,
  approvals text,
  today_actions text,
  email_sent boolean DEFAULT false,
  email_sent_at text,
  dismissed boolean DEFAULT false,
  dismissed_at text,
  created_at text DEFAULT 'now()'
);

-- ── deliverables ──
CREATE TABLE IF NOT EXISTS public.deliverables (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  project_id uuid NOT NULL -- Note: This is a Foreign Key to `projects.id`.<fk table='projects' column='id'/>,
  milestone_id uuid -- Note: This is a Foreign Key to `milestones.id`.<fk table='milestones' column='id'/>,
  title text NOT NULL,
  description text,
  file_url text,
  file_type text,
  file_size integer,
  version integer DEFAULT 1,
  uploaded_by uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  created_at text DEFAULT 'now()'
);

-- ── foundation_changelog ──
CREATE TABLE IF NOT EXISTS public.foundation_changelog (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  profile_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  signal_type text NOT NULL,
  agent_id text,
  source_task_id uuid -- Note: This is a Foreign Key to `agent_tasks.id`.<fk table='agent_tasks' column='id'/>,
  content_summary text NOT NULL,
  raw_context text,
  created_at text NOT NULL DEFAULT 'now()'
);

-- ── foundation_documents ──
CREATE TABLE IF NOT EXISTS public.foundation_documents (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  type text NOT NULL,
  title text,
  content text,
  markdown text,
  version integer DEFAULT 1,
  created_at text DEFAULT 'now()',
  updated_at text DEFAULT 'now()'
);

-- ── foundation_field_scores ──
CREATE TABLE IF NOT EXISTS public.foundation_field_scores (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  field_key text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  feedback text,
  updated_at text DEFAULT 'now()'
);

-- ── foundation_knowledge ──
CREATE TABLE IF NOT EXISTS public.foundation_knowledge (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  profile_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  source_type text NOT NULL,
  source_name text,
  raw_content text,
  extraction_result text,
  confirmed_fields text,
  storage_path text,
  created_at text DEFAULT 'now()',
  updated_at text DEFAULT 'now()',
  source_purpose text -- own_business | competitor | market_reference | customer_voice | unknown,
  purpose_confidence text -- high | medium | low — classifier confidence for source_purpose,
  purpose_reason text
);

-- ── foundation_layers ──
CREATE TABLE IF NOT EXISTS public.foundation_layers (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  profile_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  source_proposal_id uuid -- Note: This is a Foreign Key to `foundation_proposals.id`.<fk table='foundation_proposals' column='id'/>,
  state text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  theme text,
  approved_at text NOT NULL DEFAULT 'now()',
  created_at text NOT NULL DEFAULT 'now()'
);

-- ── foundation_proposals ──
CREATE TABLE IF NOT EXISTS public.foundation_proposals (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  profile_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  state text NOT NULL,
  guardian_verdict text NOT NULL,
  proposal_title text NOT NULL,
  proposal_body text NOT NULL,
  phase1_excerpt text,
  signal_summary text NOT NULL,
  source_changelog_ids jsonb NOT NULL,
  theme text,
  rationale text,
  created_at text NOT NULL DEFAULT 'now()',
  user_decision text NOT NULL DEFAULT 'pending',
  decided_at text,
  decision_note text
);

-- ── integrations ──
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  platform text NOT NULL,
  access_token text,
  refresh_token text,
  account_id text,
  account_name text,
  account_avatar text,
  settings text,
  is_active boolean DEFAULT true,
  connected_at text DEFAULT 'now()',
  expires_at text
);

-- ── marketing_chat_logs ──
CREATE TABLE IF NOT EXISTS public.marketing_chat_logs (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  session_id text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  cost_usd numeric,
  ip_hash text NOT NULL,
  created_at text NOT NULL DEFAULT 'now()'
);

-- ── maya_sessions ──
CREATE TABLE IF NOT EXISTS public.maya_sessions (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  messages text NOT NULL,
  mode text,
  updated_at text NOT NULL DEFAULT 'now()',
  title text,
  canvas_context text
);

-- ── milestones ──
CREATE TABLE IF NOT EXISTS public.milestones (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  project_id uuid NOT NULL -- Note: This is a Foreign Key to `projects.id`.<fk table='projects' column='id'/>,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  completed_at text,
  sort_order integer DEFAULT 0,
  created_at text DEFAULT 'now()'
);

-- ── notifications ──
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  title text NOT NULL,
  body text,
  type text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_at text DEFAULT 'now()',
  sender_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  email_sent boolean DEFAULT false
);

-- ── oauth_states ──
CREATE TABLE IF NOT EXISTS public.oauth_states (
  nonce text NOT NULL -- Note: This is a Primary Key.<pk/>,
  clerk_id text NOT NULL,
  provider text NOT NULL,
  expires_at text NOT NULL,
  created_at text NOT NULL DEFAULT 'now()'
);

-- ── orchestration_sessions ──
CREATE TABLE IF NOT EXISTS public.orchestration_sessions (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  triggered_by text,
  status text DEFAULT 'running',
  total_tasks integer DEFAULT 0,
  completed_tasks integer DEFAULT 0,
  total_input_tokens integer DEFAULT 0,
  total_output_tokens integer DEFAULT 0,
  total_cost_usd numeric DEFAULT 0,
  budget_cap_usd numeric,
  budget_exceeded boolean DEFAULT false,
  created_at text DEFAULT 'now()',
  completed_at text,
  agent_ids jsonb,
  agent_status text
);

-- ── order_deliverables ──
CREATE TABLE IF NOT EXISTS public.order_deliverables (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  order_id uuid NOT NULL -- Note: This is a Foreign Key to `orders.id`.<fk table='orders' column='id'/>,
  title text NOT NULL,
  file_url text,
  file_type text,
  version integer DEFAULT 1,
  uploaded_by uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  created_at text DEFAULT 'now()'
);

-- ── order_messages ──
CREATE TABLE IF NOT EXISTS public.order_messages (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  order_id uuid NOT NULL -- Note: This is a Foreign Key to `orders.id`.<fk table='orders' column='id'/>,
  sender_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  role text NOT NULL,
  body text NOT NULL,
  created_at text DEFAULT 'now()'
);

-- ── order_revisions ──
CREATE TABLE IF NOT EXISTS public.order_revisions (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  order_id uuid NOT NULL -- Note: This is a Foreign Key to `orders.id`.<fk table='orders' column='id'/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  feedback text NOT NULL,
  created_at text DEFAULT 'now()'
);

-- ── orders ──
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  assigned_admin_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  service_type text NOT NULL,
  title text NOT NULL,
  brief text,
  status text NOT NULL DEFAULT 'submitted',
  priority text DEFAULT 'medium',
  due_date date,
  delivered_at text,
  approved_at text,
  created_at text DEFAULT 'now()',
  updated_at text DEFAULT 'now()'
);

-- ── platform_settings ──
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  key text NOT NULL,
  value text NOT NULL,
  updated_at text DEFAULT 'now()'
);

-- ── profiles ──
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  email text NOT NULL,
  full_name text,
  company_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'client',
  plan text,
  status text NOT NULL DEFAULT 'onboarding',
  stripe_customer_id text,
  stripe_subscription_id text,
  onboarding_complete boolean DEFAULT false,
  business_type text,
  business_goals jsonb,
  website_url text,
  instagram_handle text,
  created_at text DEFAULT 'now()',
  updated_at text DEFAULT 'now()',
  clerk_user_id text,
  ga_measurement_id text,
  meta_ad_account_id text,
  ga_refresh_token text,
  ga_oauth_email text,
  ga_connected boolean DEFAULT false,
  meta_access_token text,
  meta_ig_account_id text,
  meta_connected boolean DEFAULT false,
  account_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  is_account_owner boolean DEFAULT true,
  ideal_customer text,
  sell_locations jsonb,
  marketing_budget text,
  competitors jsonb,
  top_goals jsonb,
  marketing_challenge text,
  content_comfort text,
  foundation_complete boolean DEFAULT false,
  foundation_step integer DEFAULT 0,
  foundation_score integer DEFAULT 0,
  foundation_answers text,
  foundation_updated_at text,
  last_active_at text,
  engagement_score integer DEFAULT 0,
  engagement_updated_at text,
  last_nudged_at text,
  email_digest boolean DEFAULT true,
  email_approvals boolean DEFAULT true,
  email_weekly boolean DEFAULT true,
  timezone text DEFAULT 'America/New_York',
  getting_started_dismissed boolean DEFAULT false,
  foundation_research text,
  foundation_research_variant text,
  foundation_knowledge_count integer DEFAULT 0,
  zernio_profile_id text,
  zernio_connected_platforms text,
  zernio_connected_at text,
  zernio_profile_ids jsonb,
  foundation_answers_previous text,
  foundation_answers_previous_at text,
  creative_direction text -- Cached CreativeDirection object from translateFoundationToCreativeDirection(),
  creative_direction_computed_at text,
  creative_direction_source_hash text -- SHA-256 of answer + document fields the translation layer reads,
  billing_exempt boolean NOT NULL DEFAULT false -- When true, account has complimentary access at profiles.plan tier — no Stripe subscription required.,
  employee_count_bucket text,
  annual_revenue_bucket text,
  site_snapshot text -- Structured SiteSnapshot from enrichFromWebsite — user-reviewed; does not mutate foundation_answers,
  site_snapshot_enabled boolean NOT NULL DEFAULT false -- When true, agents read site_snapshot in buildAgentContext,
  site_snapshot_generated_at text,
  site_snapshot_source_url text
);

-- ── project_inquiries ──
CREATE TABLE IF NOT EXISTS public.project_inquiries (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  service_type text NOT NULL,
  project_name text NOT NULL,
  description text NOT NULL,
  platform jsonb,
  has_existing_brand boolean DEFAULT false,
  has_existing_designs boolean DEFAULT false,
  timeline text,
  budget_range text,
  additional_notes text,
  status text DEFAULT 'new',
  admin_notes text,
  proposal_url text,
  created_at text DEFAULT 'now()',
  updated_at text DEFAULT 'now()'
);

-- ── projects ──
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  title text NOT NULL,
  description text,
  phase text NOT NULL DEFAULT 'discovery',
  progress_percent integer DEFAULT 0,
  start_date date,
  due_date date,
  created_at text DEFAULT 'now()',
  updated_at text DEFAULT 'now()'
);

-- ── prompt_library ──
CREATE TABLE IF NOT EXISTS public.prompt_library (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  prompt text NOT NULL,
  variables text,
  time_saved_mins integer DEFAULT 15,
  is_active boolean DEFAULT true,
  is_premium boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at text DEFAULT 'now()'
);

-- ── prompts ──
CREATE TABLE IF NOT EXISTS public.prompts (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  version integer NOT NULL DEFAULT 1,
  content text NOT NULL,
  created_at text NOT NULL DEFAULT 'now()',
  is_active boolean NOT NULL DEFAULT true
);

-- ── saved_prompts ──
CREATE TABLE IF NOT EXISTS public.saved_prompts (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  title text NOT NULL,
  prompt text NOT NULL,
  category text,
  created_at text DEFAULT 'now()'
);

-- ── services ──
CREATE TABLE IF NOT EXISTS public.services (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  name text NOT NULL,
  description text,
  icon text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at text DEFAULT 'now()',
  category text,
  requires_scope boolean DEFAULT false
);

-- ── support_messages ──
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  ticket_id uuid NOT NULL -- Note: This is a Foreign Key to `support_tickets.id`.<fk table='support_tickets' column='id'/>,
  sender_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  role text NOT NULL,
  body text NOT NULL,
  created_at text DEFAULT 'now()'
);

-- ── support_tickets ──
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  assigned_admin_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text DEFAULT 'medium',
  resolved_at text,
  created_at text DEFAULT 'now()',
  updated_at text DEFAULT 'now()',
  body text
);

-- ── team_members ──
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  account_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  member_profile_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  role text DEFAULT 'member',
  permissions text,
  status text DEFAULT 'pending',
  invited_email text,
  invite_token text,
  created_at text DEFAULT 'now()'
);

-- ── team_task_notes ──
CREATE TABLE IF NOT EXISTS public.team_task_notes (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  task_id uuid NOT NULL -- Note: This is a Foreign Key to `agent_tasks.id`.<fk table='agent_tasks' column='id'/>,
  workspace_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  author_profile_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  body text NOT NULL,
  created_at text NOT NULL DEFAULT 'now()'
);

-- ── template_downloads ──
CREATE TABLE IF NOT EXISTS public.template_downloads (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  template_id uuid NOT NULL -- Note: This is a Foreign Key to `templates.id`.<fk table='templates' column='id'/>,
  created_at text DEFAULT 'now()'
);

-- ── templates ──
CREATE TABLE IF NOT EXISTS public.templates (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  file_url text,
  preview_url text,
  is_active boolean DEFAULT true,
  is_premium boolean DEFAULT false,
  download_count integer DEFAULT 0,
  created_at text DEFAULT 'now()'
);

-- ── v_account_month_cost ──
CREATE TABLE IF NOT EXISTS public.v_account_month_cost (
  user_id uuid -- Note: This is a Primary Key.<pk/>,
  company_name text,
  plan text,
  mrr_usd integer,
  tasks_this_month bigint,
  input_tokens bigint,
  output_tokens bigint,
  cached_tokens bigint,
  cost_usd numeric,
  maya_cost_usd numeric,
  credits_remaining integer,
  month_start text
);

-- ── v_admin_x_usage_summary ──
CREATE TABLE IF NOT EXISTS public.v_admin_x_usage_summary (
  x_calls_30d bigint,
  x_cost_30d numeric,
  x_active_tenants_30d bigint,
  total_calls_30d bigint,
  total_estimated_cost_30d numeric
);

-- ── v_x_usage_30d ──
CREATE TABLE IF NOT EXISTS public.v_x_usage_30d (
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  company_name text,
  plan text,
  x_call_count bigint,
  x_estimated_cost_usd numeric
);

-- ── value_snapshots ──
CREATE TABLE IF NOT EXISTS public.value_snapshots (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  hours_saved numeric DEFAULT 0,
  content_count integer DEFAULT 0,
  posts_published integer DEFAULT 0,
  emails_sent integer DEFAULT 0,
  ai_outputs_generated integer DEFAULT 0,
  follower_delta integer DEFAULT 0,
  website_sessions integer DEFAULT 0,
  leads_captured integer DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT 'CURRENT_DATE',
  created_at text DEFAULT 'now()'
);

-- ── white_label_tools ──
CREATE TABLE IF NOT EXISTS public.white_label_tools (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid NOT NULL -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  tool_type text NOT NULL,
  custom_slug text,
  brand_name text,
  logo_url text,
  accent_color text DEFAULT '#c8522a',
  is_active boolean DEFAULT true,
  usage_count integer DEFAULT 0,
  created_at text DEFAULT 'now()'
);

-- ── zernio_api_usage ──
CREATE TABLE IF NOT EXISTS public.zernio_api_usage (
  id uuid NOT NULL DEFAULT 'gen_random_uuid()' -- Note: This is a Primary Key.<pk/>,
  user_id uuid -- Note: This is a Foreign Key to `profiles.id`.<fk table='profiles' column='id'/>,
  zernio_profile_id text,
  platform text,
  operation text NOT NULL,
  http_method text NOT NULL DEFAULT 'GET',
  path text NOT NULL,
  status_code integer,
  estimated_cost_usd numeric NOT NULL DEFAULT 0,
  metadata text,
  created_at text NOT NULL DEFAULT 'now()'
);

-- ── maya_sessions — live constraints + indexes (Phase 1 / F2 confirmed) ──
ALTER TABLE public.maya_sessions ADD PRIMARY KEY (id);
ALTER TABLE public.maya_sessions ADD FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX maya_sessions_pkey ON public.maya_sessions USING btree (id);
CREATE INDEX maya_sessions_user_id_idx ON public.maya_sessions USING btree (user_id);
CREATE INDEX idx_maya_sessions_user_updated ON public.maya_sessions USING btree (user_id, updated_at DESC);
