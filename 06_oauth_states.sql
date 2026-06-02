-- =============================================================================
-- oauth_states — single-use nonces for OAuth CSRF binding (C4)
-- Run in Supabase SQL editor.
-- =============================================================================

create table if not exists public.oauth_states (
  nonce      text        primary key,
  clerk_id   text        not null,
  provider   text        not null,   -- 'google' | 'meta'
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Only service_role can read/write. No direct user access needed.
alter table public.oauth_states enable row level security;

-- Clean up expired nonces automatically (optional; run as a cron or let the
-- callback DELETE handle it — expired rows are harmless).
create index if not exists oauth_states_expires_at_idx on public.oauth_states (expires_at);