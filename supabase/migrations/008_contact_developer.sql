create table if not exists contact_developer (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  user_email text not null,
  message    text not null check (char_length(message) <= 2000),
  created_at timestamptz not null default now()
);

alter table contact_developer enable row level security;

create policy "users insert own message" on contact_developer
  for insert with check (auth.uid() = user_id);
