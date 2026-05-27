create table if not exists chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  qr_code_id    uuid references qr_codes(id) on delete cascade not null,
  owner_id      uuid references auth.users(id) on delete cascade not null,
  scanner_name  text not null,
  scanner_phone text,
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  created_at    timestamptz not null default now()
);

create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references chat_sessions(id) on delete cascade not null,
  sender_role text not null check (sender_role in ('scanner', 'owner')),
  body        text not null check (char_length(body) <= 2000),
  created_at  timestamptz not null default now()
);

create index if not exists chat_messages_session_created
  on chat_messages (session_id, created_at asc);

alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;

drop policy if exists "owner reads own sessions"        on chat_sessions;
drop policy if exists "scanner reads session by id"     on chat_sessions;
drop policy if exists "owner reads own messages"        on chat_messages;
drop policy if exists "scanner reads messages by session" on chat_messages;
drop policy if exists "owner inserts message"           on chat_messages;
drop policy if exists "scanner inserts message"         on chat_messages;

-- Owner: full read on their sessions
create policy "owner reads own sessions" on chat_sessions
  for select using (auth.uid() = owner_id);

-- Scanner: can read a session if they know the UUID and it hasn't expired
create policy "scanner reads session by id" on chat_sessions
  for select using (auth.uid() is null and expires_at > now());

-- Owner: read messages in their sessions
create policy "owner reads own messages" on chat_messages
  for select using (
    exists (
      select 1 from chat_sessions cs
      where cs.id = session_id and cs.owner_id = auth.uid()
    )
  );

-- Scanner: read messages for a non-expired session (anon, UUID-gated by client query)
create policy "scanner reads messages by session" on chat_messages
  for select using (
    auth.uid() is null
    and exists (
      select 1 from chat_sessions cs
      where cs.id = session_id and cs.expires_at > now()
    )
  );

-- Owner: insert messages into their own non-expired sessions
create policy "owner inserts message" on chat_messages
  for insert with check (
    sender_role = 'owner'
    and exists (
      select 1 from chat_sessions cs
      where cs.id = session_id
        and cs.owner_id = auth.uid()
        and cs.expires_at > now()
    )
  );

-- Scanner: insert messages into non-expired sessions (anon)
create policy "scanner inserts message" on chat_messages
  for insert with check (
    sender_role = 'scanner'
    and auth.uid() is null
    and exists (
      select 1 from chat_sessions cs
      where cs.id = session_id and cs.expires_at > now()
    )
  );

-- Enable Realtime for chat_messages
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table chat_messages;
  end if;
end $$;

-- pg_cron: delete expired sessions every 10 minutes (cascades to chat_messages)
-- Requires pg_cron extension enabled in Supabase Dashboard → Database → Extensions → pg_cron
-- Run this block separately AFTER enabling the extension:
--
-- select cron.schedule(
--   'delete-expired-chat-sessions',
--   '*/10 * * * *',
--   $$ delete from public.chat_sessions where expires_at < now(); $$
-- );
