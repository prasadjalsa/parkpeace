-- Track failed login attempts for account lockout
create table if not exists public.login_attempts (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  ip          text,
  failed_at   timestamptz not null default now()
);

create index if not exists login_attempts_email_time on login_attempts (email, failed_at desc);

-- No RLS needed — only accessible via service role in Edge Functions
alter table login_attempts enable row level security;

-- Auto-clean attempts older than 15 minutes (lockout window)
-- Run after enabling pg_cron:
-- select cron.schedule('clean-login-attempts', '*/15 * * * *',
--   $$ delete from public.login_attempts where failed_at < now() - interval '15 minutes'; $$);
