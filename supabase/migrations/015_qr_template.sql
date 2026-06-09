-- Add template type to qr_codes so users can choose Car or Home/Flat template
alter table qr_codes add column if not exists template text not null default 'car'
  check (template in ('car', 'home'));

-- Prevent duplicate QR code names within the same user account
alter table qr_codes drop constraint if exists qr_codes_user_name_unique;
alter table qr_codes add constraint qr_codes_user_name_unique unique (user_id, name);
