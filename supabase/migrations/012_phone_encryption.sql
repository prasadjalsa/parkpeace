-- Drop the masking views created in 012 (no longer needed)
drop view if exists public.profiles_masked;
drop view if exists public.scan_events_masked;
drop view if exists public.chat_sessions_masked;
drop function if exists public.mask_phone(text);

-- Enable pgcrypto extension for symmetric encryption
create extension if not exists pgcrypto;

-- Encrypt helper: takes plaintext + key, returns base64 ciphertext
create or replace function public.encrypt_phone(p_value text, p_key text)
returns text language sql security definer as $$
  select encode(pgp_sym_encrypt(p_value, p_key), 'base64');
$$;

-- Decrypt helper: takes base64 ciphertext + key, returns plaintext
create or replace function public.decrypt_phone(p_value text, p_key text)
returns text language sql security definer as $$
  select pgp_sym_decrypt(decode(p_value, 'base64'), p_key);
$$;

-- ── Encrypt existing data ─────────────────────────────────────────────────────
-- Run the block below AFTER:
--   1. Adding PHONE_ENCRYPTION_KEY to Supabase Edge Function secrets
--   2. Copying that same key value and running:
--        set local app.phone_key = '<your-key>';
--      before executing the UPDATE statements.
--
-- The guard (phone not like 'hQ%') prevents double-encryption on re-runs.
-- pgp_sym_encrypt output always starts with 'hQ' when base64-encoded.

-- set local app.phone_key = '<paste-your-PHONE_ENCRYPTION_KEY-here>';
--
-- update public.profiles set
--   phone           = public.encrypt_phone(phone,           current_setting('app.phone_key')),
--   whatsapp_number = case when whatsapp_number is not null
--                     then public.encrypt_phone(whatsapp_number, current_setting('app.phone_key'))
--                     else null end,
--   emergency_phone = case when emergency_phone is not null
--                     then public.encrypt_phone(emergency_phone, current_setting('app.phone_key'))
--                     else null end
-- where phone is not null and phone not like 'ww0E%';
--
-- update public.scan_events set
--   scanner_phone = public.encrypt_phone(scanner_phone, current_setting('app.phone_key'))
-- where scanner_phone is not null and scanner_phone not like 'hQ%';
--
-- update public.chat_sessions set
--   scanner_phone = public.encrypt_phone(scanner_phone, current_setting('app.phone_key'))
-- where scanner_phone is not null and scanner_phone not like 'hQ%';
