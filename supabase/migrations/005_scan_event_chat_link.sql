alter table scan_events
  add column if not exists chat_session_id uuid references chat_sessions(id) on delete set null;
