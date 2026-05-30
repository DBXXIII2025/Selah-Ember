-- Phase 9 event RSVP foundation.
-- Adds going/interested RSVP participation for events.

alter table public.events enable row level security;

drop policy if exists "Public can read events" on public.events;
create policy "Public can read events"
on public.events for select
to anon, authenticated
using (true);

create table if not exists public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id),
  constraint event_rsvps_status_check check (status in ('going', 'interested'))
);

alter table public.event_rsvps enable row level security;

drop trigger if exists set_event_rsvps_updated_at on public.event_rsvps;
create trigger set_event_rsvps_updated_at
before update on public.event_rsvps
for each row execute function public.set_updated_at();

drop policy if exists "Users can read their own event RSVPs" on public.event_rsvps;
create policy "Users can read their own event RSVPs"
on public.event_rsvps for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own event RSVPs" on public.event_rsvps;
create policy "Users can create their own event RSVPs"
on public.event_rsvps for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own event RSVPs" on public.event_rsvps;
create policy "Users can update their own event RSVPs"
on public.event_rsvps for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own event RSVPs" on public.event_rsvps;
create policy "Users can delete their own event RSVPs"
on public.event_rsvps for delete
to authenticated
using (auth.uid() = user_id);
