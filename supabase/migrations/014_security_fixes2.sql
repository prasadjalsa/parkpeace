-- qr_codes: the "public qr read" policy is intentionally kept for the scanner page
-- which reads QR code name anonymously by UUID. The UUID is the security boundary.
-- user_id is exposed but only to callers who already know the QR UUID.
-- The real risk (bulk enumeration) is mitigated by UUID entropy (122 bits).
-- No change to qr_codes policy — documented as accepted risk.

-- Add defensive RLS policies on otp_challenges to prevent accidental exposure
drop policy if exists "users read own otp_challenges" on otp_challenges;
drop policy if exists "deny otp update" on otp_challenges;
drop policy if exists "deny otp delete" on otp_challenges;

create policy "users read own otp_challenges" on otp_challenges
  for select using (auth.uid() = user_id);

-- Block direct updates/deletes — only Edge Functions via service role can modify
create policy "deny otp update" on otp_challenges
  for update using (false);

create policy "deny otp delete" on otp_challenges
  for delete using (false);
