-- Phone masking at database level.
-- Raw values stay in the tables for app functionality.
-- A masking function and views expose masked values for DB admin browsing.

-- Masking function: shows first digit + ***** + last 4 digits
-- e.g. '9876543210' → '9*****3210'
create or replace function public.mask_phone(p text)
returns text
language sql
immutable
as $$
  select case
    when p is null or length(p) = 0 then p
    when length(p) <= 5 then repeat('*', length(p))
    else left(p, 1) || repeat('*', length(p) - 5) || right(p, 4)
  end;
$$;

-- Masked view of profiles for admin browsing
create or replace view public.profiles_masked as
select
  id,
  full_name,
  mask_phone(phone)            as phone,
  mask_phone(whatsapp_number)  as whatsapp_number,
  emergency_name,
  mask_phone(emergency_phone)  as emergency_phone,
  emergency_rel,
  fcm_token,
  is_developer,
  updated_at
from public.profiles;

-- Masked view of scan_events for admin browsing
create or replace view public.scan_events_masked as
select
  id,
  qr_code_id,
  action,
  scanner_name,
  mask_phone(scanner_phone) as scanner_phone,
  scanner_note,
  scanned_at,
  chat_session_id
from public.scan_events;

-- Masked view of chat_sessions for admin browsing
create or replace view public.chat_sessions_masked as
select
  id,
  qr_code_id,
  owner_id,
  scanner_name,
  mask_phone(scanner_phone) as scanner_phone,
  expires_at,
  created_at
from public.chat_sessions;
