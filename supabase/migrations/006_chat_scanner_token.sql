-- Store scanner's FCM token so the owner's replies can push to the scanner too.
-- The scanner opts in voluntarily — column is nullable.
alter table chat_sessions
  add column if not exists scanner_fcm_token text;

-- Allow anonymous callers to set scanner_fcm_token on their own session (opt-in push).
-- The session UUID is the credential — only someone who knows it can update it.
drop policy if exists "scanner updates own token" on chat_sessions;
create policy "scanner updates own token" on chat_sessions
  for update
  using  (auth.uid() is null and expires_at > now())
  with check (auth.uid() is null);
