-- Audit log table — records key user actions for forensic traceability
create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  user_email text,
  action     text not null,
  details    jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at on audit_log (created_at desc);
create index if not exists audit_log_action on audit_log (action);

alter table audit_log enable row level security;

-- Only developer can read audit logs
drop policy if exists "developer reads audit log" on audit_log;
create policy "developer reads audit log" on audit_log
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_developer = true)
  );

-- Authenticated users can insert their own audit entries
drop policy if exists "users insert own audit log" on audit_log;
create policy "users insert own audit log" on audit_log
  for insert with check (auth.uid() = user_id);
