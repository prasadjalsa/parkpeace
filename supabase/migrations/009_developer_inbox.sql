-- Add is_developer flag to profiles. Only manually set for the developer account.
alter table profiles add column if not exists is_developer boolean not null default false;

-- Allow developer to read all contact_developer messages
drop policy if exists "developer reads all messages" on contact_developer;
create policy "developer reads all messages" on contact_developer
  for select using (
    exists (select 1 from profiles where id = auth.uid() and is_developer = true)
  );

-- Allow developer to delete messages
drop policy if exists "developer deletes messages" on contact_developer;
create policy "developer deletes messages" on contact_developer
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and is_developer = true)
  );
