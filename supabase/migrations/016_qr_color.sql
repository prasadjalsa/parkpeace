-- Add header colour to qr_codes for custom QR card branding
alter table qr_codes add column if not exists header_color text not null default '#16a34a';
