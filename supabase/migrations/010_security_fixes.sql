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
