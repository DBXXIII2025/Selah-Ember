-- Enforce notification immutability through an unambiguous canonical trigger.
-- Ordinary recipients may update read-state only. Account deletion may scrub
-- actor_user_id only through the trusted server-side deletion helper.

create or replace function public.enforce_notification_immutable_fields_v2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.user_id is distinct from new.user_id
    or old.type is distinct from new.type
    or old.title is distinct from new.title
    or old.body is distinct from new.body
    or old.href is distinct from new.href
    or old.created_at is distinct from new.created_at
  then
    raise exception 'Only notification read state can be updated';
  end if;

  if old.actor_user_id is distinct from new.actor_user_id
    and not (
      old.actor_user_id is not null
      and new.actor_user_id is null
      and coalesce(
        current_setting('app.notification_actor_scrub_context', true),
        ''
      ) = 'trusted_account_deletion_v1'
    )
  then
    raise exception 'Only notification read state can be updated';
  end if;

  return new;
end;
$$;

-- Neutralize the legacy function name in case any unexpected live trigger is
-- still bound to it.
create or replace function public.prevent_notification_content_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.user_id is distinct from new.user_id
    or old.type is distinct from new.type
    or old.title is distinct from new.title
    or old.body is distinct from new.body
    or old.href is distinct from new.href
    or old.created_at is distinct from new.created_at
  then
    raise exception 'Only notification read state can be updated';
  end if;

  if old.actor_user_id is distinct from new.actor_user_id
    and not (
      old.actor_user_id is not null
      and new.actor_user_id is null
      and coalesce(
        current_setting('app.notification_actor_scrub_context', true),
        ''
      ) = 'trusted_account_deletion_v1'
    )
  then
    raise exception 'Only notification read state can be updated';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_notification_immutable_fields_v2() from public;
revoke execute on function public.enforce_notification_immutable_fields_v2() from anon;
revoke execute on function public.enforce_notification_immutable_fields_v2() from authenticated;
revoke execute on function public.prevent_notification_content_update() from public;
revoke execute on function public.prevent_notification_content_update() from anon;
revoke execute on function public.prevent_notification_content_update() from authenticated;

create or replace function public.scrub_deleted_user_notification_actors(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  perform set_config(
    'app.notification_actor_scrub_context',
    'trusted_account_deletion_v1',
    true
  );

  update public.notifications
  set actor_user_id = null
  where actor_user_id = target_user_id;

  get diagnostics affected = row_count;
  perform set_config('app.notification_actor_scrub_context', '', true);
  return affected;
exception
  when others then
    perform set_config('app.notification_actor_scrub_context', '', true);
    raise;
end;
$$;

revoke execute on function public.scrub_deleted_user_notification_actors(uuid) from public;
revoke execute on function public.scrub_deleted_user_notification_actors(uuid) from anon;
revoke execute on function public.scrub_deleted_user_notification_actors(uuid) from authenticated;
grant execute on function public.scrub_deleted_user_notification_actors(uuid) to service_role;

drop trigger if exists prevent_notification_content_update on public.notifications;
drop trigger if exists notifications_prevent_content_update on public.notifications;
drop trigger if exists prevent_notifications_content_update on public.notifications;
drop trigger if exists notifications_enforce_immutable_fields on public.notifications;
drop trigger if exists notification_enforce_immutable_fields_v2 on public.notifications;
drop trigger if exists notifications_enforce_immutable_fields_v2 on public.notifications;

do $$
declare
  notification_trigger record;
begin
  for notification_trigger in
    select pg_trigger.tgname
    from pg_trigger
    join pg_class
      on pg_class.oid = pg_trigger.tgrelid
    join pg_namespace
      on pg_namespace.oid = pg_class.relnamespace
    join pg_proc
      on pg_proc.oid = pg_trigger.tgfoid
    where pg_namespace.nspname = 'public'
      and pg_class.relname = 'notifications'
      and not pg_trigger.tgisinternal
      and pg_proc.proname in (
        'prevent_notification_content_update',
        'enforce_notification_immutable_fields_v2'
      )
  loop
    execute format(
      'drop trigger if exists %I on public.notifications',
      notification_trigger.tgname
    );
  end loop;
end;
$$;

create trigger notifications_enforce_immutable_fields_v2
before update on public.notifications
for each row
execute function public.enforce_notification_immutable_fields_v2();
