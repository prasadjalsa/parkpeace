-- Add lockout count tracking to profiles for exponential backoff
alter table profiles add column if not exists lockout_count integer not null default 0;
alter table profiles add column if not exists last_lockout_at timestamptz;
