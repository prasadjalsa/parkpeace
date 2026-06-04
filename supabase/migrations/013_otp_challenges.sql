-- OTP challenges table for email-based 2FA
create table if not exists otp_challenges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  code       text not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used       boolean not null default false,
  created_at timestamptz not null default now()
);

-- Only the user can read their own challenges (via service role in Edge Functions)
alter table otp_challenges enable row level security;

-- Index for fast lookup
create index if not exists otp_challenges_user_expires on otp_challenges (user_id, expires_at);

-- Add otp_enabled flag to profiles (default true — on for all users)
alter table profiles add column if not exists otp_enabled boolean not null default true;

-- Update existing RLS: allow update of otp_enabled (is_developer still blocked)
drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and is_developer = false);

-- Clean up expired/used OTP challenges every 5 minutes
-- Run after enabling pg_cron:
-- select cron.schedule('clean-otp-challenges', '*/5 * * * *',
--   $$ delete from public.otp_challenges where expires_at < now() or used = true; $$);
