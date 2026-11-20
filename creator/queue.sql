create schema parasite_queue;
revoke all on schema parasite_queue from public;
create table parasite_queue.config (key_digest text not null);
create table parasite_queue.requests (
  id uuid primary key,
  brief text not null check (char_length(brief) between 10 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  state text not null default 'queued'
    check (state in ('queued','building','deployed','needs_input','blocked')),
  note text,
  release_url text
);
alter table parasite_queue.config enable row level security;
alter table parasite_queue.requests enable row level security;
create index on parasite_queue.requests (state, created_at);

create function public.parasite_creator_queue(api_token text, request_id uuid default null, request_brief text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare entry parasite_queue.requests;
begin
  if not exists (
    select 1 from parasite_queue.config
    where key_digest = encode(sha256(convert_to(api_token, 'UTF8')), 'hex')
  ) then
    raise sqlstate '28000' using message = 'Invalid queue credential';
  end if;

  if request_id is null then
    return (
      select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb)
      from (select * from parasite_queue.requests order by created_at desc limit 50) q
    );
  end if;

  insert into parasite_queue.requests (id, brief) values (request_id, trim(request_brief))
    on conflict (id) do nothing;
  select * into entry from parasite_queue.requests where id = request_id;
  if entry.brief is distinct from trim(request_brief) then
    raise sqlstate '23505' using message = 'Request identifier already used';
  end if;
  return to_jsonb(entry);
end;
$$;

revoke all on function public.parasite_creator_queue(text, uuid, text) from public, anon, authenticated;
grant execute on function public.parasite_creator_queue(text, uuid, text) to anon;
