-- Add template type to qr_codes so users can choose Car or Home/Flat template
alter table qr_codes add column if not exists template text not null default 'car'
  check (template in ('car', 'home'));
