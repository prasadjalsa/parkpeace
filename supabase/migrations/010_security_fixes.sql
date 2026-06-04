-- Fix is_developer escalation: split "own profile" for all into separate policies
-- that prevent any user from setting is_developer = true via the app.

drop policy if exists "own profile"        on profiles;
drop policy if exists "own profile read"   on profiles;
drop policy if exists "own profile update" on profiles;
drop policy if exists "own profile insert" on profiles;

create policy "own profile read" on profiles
  for select using (auth.uid() = id);

-- UPDATE: user can update own profile but cannot set is_developer = true
create policy "own profile update" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and is_developer = false);

-- INSERT: new profiles always start with is_developer = false
create policy "own profile insert" on profiles
  for insert with check (auth.uid() = id and is_developer = false);

-- Fix scanner_fcm_token: allow updates to set/rotate the token,
-- but not blank it out (must always be a non-empty string when set).
drop policy if exists "scanner updates own token" on chat_sessions;

create policy "scanner updates own token" on chat_sessions
  for update
  using  (auth.uid() is null and expires_at > now())
  with check (
    auth.uid() is null
    and scanner_fcm_token is not null
    and length(scanner_fcm_token) > 10
  );

-- Fix CRITICAL PII exposure: remove anon SELECT on chat_sessions.
-- Scanners now read sessions via the session-verify Edge Function (service role).
-- Owner reads are protected by the existing "owner reads own sessions" RLS policy.
drop policy if exists "scanner reads session by id" on chat_sessions;

-- The scanner insert/select policies on chat_messages use an exists() subquery
-- against chat_sessions. Now that anon SELECT on chat_sessions is removed,
-- that subquery would fail. Use a security definer function instead — it runs
-- as the postgres role (bypasses RLS) so it can check session validity without
-- exposing any rows to the anon caller.
create or replace function public.chat_session_valid(p_session_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.chat_sessions
    where id = p_session_id
    and expires_at > now()
  );
$$;

-- Re-create scanner policies to use the security definer function
drop policy if exists "scanner reads messages by session"  on chat_messages;
drop policy if exists "scanner inserts message"            on chat_messages;

create policy "scanner reads messages by session" on chat_messages
  for select using (
    auth.uid() is null
    and public.chat_session_valid(session_id)
  );

create policy "scanner inserts message" on chat_messages
  for insert with check (
    sender_role = 'scanner'
    and auth.uid() is null
    and public.chat_session_valid(session_id)
  );
