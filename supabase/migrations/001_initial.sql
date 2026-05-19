-- ParkPeace database schema
-- Idempotent — safe to run multiple times

-- Tables
create table if not exists profiles (
  id              uuid references auth.users on delete cascade primary key,
  full_name       text,
  phone           text not null default '',
  emergency_name  text,
  emergency_phone text,
  emergency_rel   text,
  fcm_token       text,
  updated_at      timestamptz default now()
);

create table if not exists qr_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users on delete cascade not null,
  name       text not null,
  created_at timestamptz default now()
);

create table if not exists scan_events (
  id           uuid primary key default gen_random_uuid(),
  qr_code_id   uuid references qr_codes on delete cascade not null,
  action       text not null,
  scanner_name text,
  scanner_note text,
  scanned_at   timestamptz default now()
);

-- Add fcm_token column if upgrading from an older schema that had onesignal_player_id
alter table profiles add column if not exists fcm_token text;

-- Row Level Security
alter table profiles    enable row level security;
alter table qr_codes    enable row level security;
alter table scan_events enable row level security;

-- Drop policies first so re-runs don't error
drop policy if exists "own profile"      on profiles;
drop policy if exists "own qr_codes"     on qr_codes;
drop policy if exists "public qr read"   on qr_codes;
drop policy if exists "own scan events"  on scan_events;

-- Recreate policies
create policy "own profile" on profiles
  for all using (auth.uid() = id);

create policy "own qr_codes" on qr_codes
  for all using (auth.uid() = user_id);

create policy "public qr read" on qr_codes
  for select using (true);

create policy "own scan events" on scan_events
  for select using (
    qr_code_id in (
      select id from qr_codes where user_id = auth.uid()
    )
  );
