-- Add lockout count tracking to profiles for exponential backoff
alter table profiles add column if not exists lockout_count integer not null default 0;
alter table profiles add column if not exists last_lockout_at timestamptz;

-- Helper to look up user_id by email (service role only)
create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
stable
as $$
  select id from auth.users where email = p_email limit 1;
$$;
