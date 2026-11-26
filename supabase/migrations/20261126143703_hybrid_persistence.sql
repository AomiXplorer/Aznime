begin;

create table public.aznime_users (
  id uuid primary key,
  username text not null,
  email text not null unique,
  avatar text not null default '',
  provider text not null check (provider in ('email', 'google', 'discord')),
  provider_id text not null default '',
  password_hash text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  favorites_version uuid not null default gen_random_uuid(),
  history_version uuid not null default gen_random_uuid(),
  check (email <> '' and email = lower(btrim(email))),
  check (provider = 'email' or provider_id <> '')
);
create unique index aznime_users_oauth_identity
  on public.aznime_users (provider, provider_id) where provider_id <> '';

create table public.aznime_library_entries (
  user_id uuid not null references public.aznime_users(id) on delete cascade,
  kind text not null check (kind in ('favorites', 'history')),
  anime_id text not null check (length(anime_id) between 1 and 200),
  recorded_ms double precision not null check (recorded_ms >= 0 and recorded_ms < 8640000000000000),
  item jsonb not null,
  primary key (user_id, kind, anime_id),
  check ((jsonb_typeof(item) = 'object' and item ->> 'animeId' = anime_id
    and jsonb_typeof(item -> 'title') = 'string' and length(item ->> 'title') between 1 and 300
    and jsonb_typeof(item -> (case kind when 'history' then 'updatedAt' else 'addedAt' end)) = 'number'
    and (item ->> (case kind when 'history' then 'updatedAt' else 'addedAt' end))::double precision = recorded_ms) is true)
);
create index aznime_library_newest
  on public.aznime_library_entries (user_id, kind, recorded_ms desc, anime_id desc);

create table public.aznime_maintenance (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null,
  message text not null check (length(message) between 1 and 500),
  started_at timestamptz,
  ends_at timestamptz,
  updated_by text,
  updated_at timestamptz
);

alter table public.aznime_users enable row level security;
alter table public.aznime_library_entries enable row level security;
alter table public.aznime_maintenance enable row level security;
revoke all on table public.aznime_users, public.aznime_library_entries, public.aznime_maintenance from public, anon, authenticated;
grant select, insert, update on public.aznime_users, public.aznime_maintenance to service_role;
grant select, insert, update, delete on public.aznime_library_entries to service_role;

-- Keep the caller's read, merge, cap, and cache version change in one transaction.
create function public.aznime_mutate_library(
  p_user uuid, p_kind text, p_action text, p_items jsonb, p_anime text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  item_limit integer;
  entry jsonb;
  result jsonb;
begin
  if p_kind is null or p_kind not in ('favorites', 'history')
    or p_action is null or p_action not in ('put', 'delete', 'sync')
    or (p_action = 'sync' and p_kind <> 'history')
    or (p_action = 'delete' and coalesce(p_anime, '') = '')
    or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) > 200
    or (p_action = 'put' and jsonb_array_length(p_items) <> 1) then
    raise exception 'Invalid library mutation' using errcode = '22023';
  end if;

  perform 1 from public.aznime_users where id = p_user for update;
  if not found then raise exception 'Account unavailable' using errcode = '23503'; end if;

  item_limit := case p_kind when 'history' then 100 else 500 end;
  if p_action = 'delete' then
    delete from public.aznime_library_entries where user_id = p_user and kind = p_kind and anime_id = p_anime;
  else
    for entry in select value from jsonb_array_elements(p_items) loop
      insert into public.aznime_library_entries as existing (user_id, kind, anime_id, recorded_ms, item)
      values (p_user, p_kind, entry ->> 'animeId',
        (entry ->> (case p_kind when 'history' then 'updatedAt' else 'addedAt' end))::double precision, entry)
      on conflict (user_id, kind, anime_id) do update
        set item = excluded.item, recorded_ms = excluded.recorded_ms
        where p_kind = 'favorites' or existing.recorded_ms <= excluded.recorded_ms;
    end loop;
    if p_action = 'put' then
      select item into result from public.aznime_library_entries
        where user_id = p_user and kind = p_kind and anime_id = p_items -> 0 ->> 'animeId';
    end if;
    delete from public.aznime_library_entries as target
      where target.user_id = p_user and target.kind = p_kind and target.anime_id in (
        select anime_id from public.aznime_library_entries
        where user_id = p_user and kind = p_kind order by recorded_ms desc, anime_id desc offset item_limit
      );
  end if;

  if p_kind = 'history' then
    update public.aznime_users set history_version = gen_random_uuid() where id = p_user;
  else
    update public.aznime_users set favorites_version = gen_random_uuid() where id = p_user;
  end if;

  if p_action = 'sync' then
    select coalesce(jsonb_agg(item order by recorded_ms desc, anime_id desc), '[]'::jsonb)
      into result from public.aznime_library_entries where user_id = p_user and kind = p_kind;
  end if;
  return result;
end;
$$;

create function public.aznime_account_counts(p_user uuid)
returns jsonb language sql security invoker set search_path = '' stable as $$
  select jsonb_build_object(
    'history', count(*) filter (where kind = 'history'),
    'favorites', count(*) filter (where kind = 'favorites'))
  from public.aznime_library_entries where user_id = p_user
$$;

-- Strictly add a frozen snapshot and reject any conflicting existing account.
-- A rerun verifies the complete account inside the same transaction.
create function public.aznime_import_account(p_user jsonb, p_entries jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  incoming public.aznime_users;
  stored public.aznime_users;
  entry jsonb;
  expected jsonb;
  actual jsonb;
begin
  incoming := jsonb_populate_record(null::public.aznime_users, p_user);
  insert into public.aznime_users
    (id, username, email, avatar, provider, provider_id, password_hash, created_at, updated_at)
    values (incoming.id, incoming.username, incoming.email, incoming.avatar, incoming.provider,
      incoming.provider_id, incoming.password_hash, incoming.created_at, incoming.updated_at)
    on conflict (id) do nothing;
  select * into stored from public.aznime_users where id = incoming.id for update;
  if (to_jsonb(stored) - 'favorites_version' - 'history_version')
    is distinct from (to_jsonb(incoming) - 'favorites_version' - 'history_version') then
    raise exception 'Conflicting account snapshot' using errcode = '23505';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array'
    or jsonb_array_length(p_entries) > 600
    or (select count(*) from jsonb_array_elements(p_entries) e where e ->> 'kind' = 'history') > 100
    or (select count(*) from jsonb_array_elements(p_entries) e where e ->> 'kind' = 'favorites') > 500 then
    raise exception 'Invalid snapshot library size' using errcode = '22023';
  end if;
  for entry in select value from jsonb_array_elements(p_entries) loop
    insert into public.aznime_library_entries (user_id, kind, anime_id, recorded_ms, item)
    values (incoming.id, entry ->> 'kind', entry -> 'item' ->> 'animeId',
      (entry -> 'item' ->> (case entry ->> 'kind' when 'history' then 'updatedAt' else 'addedAt' end))::double precision,
      entry -> 'item')
    on conflict (user_id, kind, anime_id) do nothing;
  end loop;
  select coalesce(jsonb_agg(value order by value ->> 'kind', value -> 'item' ->> 'animeId'), '[]'::jsonb)
    into expected from jsonb_array_elements(p_entries);
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'item', item) order by kind, anime_id), '[]'::jsonb)
    into actual from public.aznime_library_entries where user_id = incoming.id;
  if actual is distinct from expected then
    raise exception 'Conflicting library snapshot' using errcode = '23505';
  end if;
  update public.aznime_users set favorites_version = gen_random_uuid(), history_version = gen_random_uuid() where id = incoming.id;
end;
$$;

revoke execute on function public.aznime_mutate_library(uuid,text,text,jsonb,text),
  public.aznime_account_counts(uuid), public.aznime_import_account(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.aznime_mutate_library(uuid,text,text,jsonb,text),
  public.aznime_account_counts(uuid), public.aznime_import_account(jsonb,jsonb) to service_role;

commit;
