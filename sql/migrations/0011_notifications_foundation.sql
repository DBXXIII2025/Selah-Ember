-- Phase 11 notifications foundation.
-- Lightweight in-app notifications for user-specific activity updates.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
on public.notifications for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can update their own notification read state" on public.notifications;
create policy "Users can update their own notification read state"
on public.notifications for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.prevent_notification_content_update()
returns trigger
language plpgsql
as $$
begin
  if new.user_id <> old.user_id
    or new.actor_user_id is distinct from old.actor_user_id
    or new.type <> old.type
    or new.title <> old.title
    or new.body is distinct from old.body
    or new.href is distinct from old.href
    or new.created_at <> old.created_at
  then
    raise exception 'Only notification read state can be updated';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_notification_content_update on public.notifications;
create trigger prevent_notification_content_update
before update on public.notifications
for each row execute function public.prevent_notification_content_update();
