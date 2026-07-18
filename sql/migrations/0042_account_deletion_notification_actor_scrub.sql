-- Allow account deletion to scrub notification actors without permitting content edits.

create or replace function public.prevent_notification_content_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id <> old.user_id
    or new.type <> old.type
    or new.title <> old.title
    or new.body is distinct from old.body
    or new.href is distinct from old.href
    or new.created_at <> old.created_at
  then
    raise exception 'Only notification read state can be updated';
  end if;

  if new.actor_user_id is distinct from old.actor_user_id
    and not (old.actor_user_id is not null and new.actor_user_id is null)
  then
    raise exception 'Only notification read state can be updated';
  end if;

  return new;
end;
$$;
