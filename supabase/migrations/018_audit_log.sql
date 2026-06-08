-- Audit log table — records key user actions for forensic traceability
create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  user_email text,
  action     text not null check (action in (
    'sign_in', 'account_deleted',
    'qr_created', 'qr_deleted', 'profile_updated'
  )),
  details    jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at on audit_log (created_at desc);
create index if not exists audit_log_action on audit_log (action);

-- Auto-populate user_email from auth.users so frontend can't forge it
create or replace function public.audit_log_set_email()
returns trigger language plpgsql security definer as $$
begin
  if NEW.user_id is not null then
    select email into NEW.user_email from auth.users where id = NEW.user_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists audit_log_email_trigger on public.audit_log;
create trigger audit_log_email_trigger
  before insert on public.audit_log
  for each row execute function public.audit_log_set_email();

alter table audit_log enable row level security;

-- Only developer can read audit logs
drop policy if exists "developer reads audit log" on audit_log;
create policy "developer reads audit log" on audit_log
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_developer = true)
  );

-- Authenticated users can insert their own audit entries (email auto-set by trigger)
drop policy if exists "users insert own audit log" on audit_log;
create policy "users insert own audit log" on audit_log
  for insert with check (auth.uid() = user_id);

-- Only developer can delete audit log entries (for manual clear)
-- Regular users cannot read or modify audit entries at all
drop policy if exists "deny audit log delete" on audit_log;
drop policy if exists "deny audit log update" on audit_log;
drop policy if exists "developer deletes audit log" on audit_log;
create policy "developer deletes audit log" on audit_log
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and is_developer = true)
  );
create policy "deny audit log update" on audit_log for update using (false);

-- Auto-clean audit log entries older than 90 days via pg_cron
-- Run after enabling pg_cron:
-- select cron.schedule('clean-audit-log', '0 2 * * *',
--   $$ delete from public.audit_log where created_at < now() - interval '90 days'; $$);
