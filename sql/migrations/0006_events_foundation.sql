-- Phase 6 events foundation.
-- Adds app-facing event_time/community_id fields and basic event RLS.

alter table public.events
  add column if not exists event_time timestamptz,
  add column if not exists community_id uuid references public.churches(id) on delete set null;

update public.events
set event_time = starts_at
where event_time is null
  and starts_at is not null;

update public.events
set community_id = church_id
where community_id is null
  and church_id is not null;

alter table public.events enable row level security;

drop policy if exists "Authenticated users can create events" on public.events;
create policy "Authenticated users can create events"
on public.events for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = events.created_by
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can read events" on public.events;
create policy "Authenticated users can read events"
on public.events for select
to authenticated
using (true);

drop policy if exists "Event creators can update their events" on public.events;
create policy "Event creators can update their events"
on public.events for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = events.created_by
      and profiles.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = events.created_by
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Event creators can delete their events" on public.events;
create policy "Event creators can delete their events"
on public.events for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = events.created_by
      and profiles.user_id = auth.uid()
  )
);
