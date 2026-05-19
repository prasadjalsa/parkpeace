alter table scan_events add column if not exists scanner_phone text;

drop policy if exists "delete own scan events" on scan_events;
create policy "delete own scan events" on scan_events for delete
  using (qr_code_id in (select id from qr_codes where user_id = auth.uid()));
