-- Track when FCM token was last updated for expiry reminders
alter table profiles add column if not exists fcm_token_updated_at timestamptz;

-- Set existing rows to now so the clock starts from today
update profiles set fcm_token_updated_at = now() where fcm_token is not null;
