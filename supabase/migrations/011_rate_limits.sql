-- Persistent rate limiting table — survives Edge Function cold starts.
create table if not exists rate_limits (
  key        text primary key,
  count      integer not null default 1,
  reset_at   timestamptz not null
);

create index if not exists rate_limits_reset_at on rate_limits (reset_at);

-- Atomic upsert function used by Edge Functions.
-- Returns TRUE if the caller should be blocked (limit exceeded), FALSE otherwise.
create or replace function public.upsert_rate_limit(
  p_key      text,
  p_max      integer,
  p_reset_at timestamptz
) returns boolean
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  -- If an existing non-expired row exists, increment it
  update public.rate_limits
  set count = count + 1
  where key = p_key and reset_at > now()
  returning count into v_count;

  if not found then
    -- Row missing or expired — start fresh
    insert into public.rate_limits (key, count, reset_at)
    values (p_key, 1, p_reset_at)
    on conflict (key) do update
      set count = 1, reset_at = excluded.reset_at;
    v_count := 1;
  end if;

  return v_count > p_max;
end;
$$;
