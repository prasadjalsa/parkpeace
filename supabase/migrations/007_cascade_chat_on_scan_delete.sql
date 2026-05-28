-- When a scan event is deleted, delete the linked chat session too.
-- The FK is scan_events → chat_sessions (not the other way), so a trigger
-- is required to cascade in this direction.

create or replace function delete_chat_on_scan_event_delete()
returns trigger language plpgsql as $$
begin
  if OLD.chat_session_id is not null then
    delete from public.chat_sessions where id = OLD.chat_session_id;
  end if;
  return OLD;
end;
$$;

drop trigger if exists trg_delete_chat_on_scan_event_delete on public.scan_events;
create trigger trg_delete_chat_on_scan_event_delete
  after delete on public.scan_events
  for each row execute function delete_chat_on_scan_event_delete();
