begin;

-- History-only deployments register only the existing application account UUID.
create table public.aznime_library_owners (
  id uuid primary key,
  history_version uuid not null default gen_random_uuid(),
  favorites_version uuid not null default gen_random_uuid()
);
alter table public.aznime_library_owners enable row level security;
revoke all on table public.aznime_library_owners from public, anon, authenticated;
grant select, insert, update on table public.aznime_library_owners to service_role;

insert into public.aznime_library_owners (id, history_version, favorites_version)
  select id, history_version, favorites_version from public.aznime_users;

alter table public.aznime_library_entries drop constraint aznime_library_entries_user_id_fkey;
alter table public.aznime_library_entries add constraint aznime_library_entries_owner_fkey
  foreign key (user_id) references public.aznime_library_owners(id) on delete cascade;

-- Full-mode account creation and the existing account importer retain their behavior.
create function public.aznime_sync_library_owner()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.aznime_library_owners where id = old.id;
    return old;
  end if;
  insert into public.aznime_library_owners (id, history_version, favorites_version)
    values (new.id, new.history_version, new.favorites_version)
    on conflict (id) do update
      set history_version = excluded.history_version, favorites_version = excluded.favorites_version;
  return new;
end;
$$;
revoke execute on function public.aznime_sync_library_owner() from public, anon, authenticated;
grant execute on function public.aznime_sync_library_owner() to service_role;
create trigger aznime_sync_library_owner
  after insert or update of history_version, favorites_version or delete on public.aznime_users
  for each row execute function public.aznime_sync_library_owner();

create or replace function public.aznime_mutate_library(
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

  -- This RPC is service-only. Next.js verifies the owner through its session.
  if p_kind = 'history' then
    insert into public.aznime_library_owners (id) values (p_user) on conflict do nothing;
  elsif not exists (select 1 from public.aznime_users where id = p_user) then
    raise exception 'Account unavailable' using errcode = '23503';
  end if;
  perform 1 from public.aznime_library_owners where id = p_user for update;
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
    update public.aznime_library_owners set history_version = gen_random_uuid() where id = p_user;
  else
    update public.aznime_library_owners set favorites_version = gen_random_uuid() where id = p_user;
  end if;

  if p_action = 'sync' then
    select coalesce(jsonb_agg(item order by recorded_ms desc, anime_id desc), '[]'::jsonb)
      into result from public.aznime_library_entries where user_id = p_user and kind = p_kind;
  end if;
  return result;
end;
$$;

create function public.aznime_import_history(p_user uuid, p_items jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  entry jsonb;
  expected jsonb;
  actual jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'Invalid history snapshot' using errcode = '22023';
  end if;
  insert into public.aznime_library_owners (id) values (p_user) on conflict do nothing;
  perform 1 from public.aznime_library_owners where id = p_user for update;
  for entry in select value from jsonb_array_elements(p_items) loop
    insert into public.aznime_library_entries (user_id, kind, anime_id, recorded_ms, item)
      values (p_user, 'history', entry ->> 'animeId', (entry ->> 'updatedAt')::double precision, entry)
      on conflict (user_id, kind, anime_id) do nothing;
  end loop;
  select coalesce(jsonb_agg(value order by value ->> 'animeId'), '[]'::jsonb)
    into expected from jsonb_array_elements(p_items);
  select coalesce(jsonb_agg(item order by anime_id), '[]'::jsonb)
    into actual from public.aznime_library_entries where user_id = p_user and kind = 'history';
  if actual is distinct from expected then
    raise exception 'Conflicting history snapshot' using errcode = '23505';
  end if;
  update public.aznime_library_owners set history_version = gen_random_uuid() where id = p_user;
end;
$$;
revoke execute on function public.aznime_import_history(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.aznime_import_history(uuid,jsonb) to service_role;

commit;
