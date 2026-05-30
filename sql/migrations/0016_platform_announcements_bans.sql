-- Phase 13 platform announcements and temporary bans.

create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  href text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  banned_user_id uuid not null references auth.users(id) on delete cascade,
  banned_by uuid references public.profiles(id) on delete set null,
  reason text not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint user_bans_window_check check (expires_at > starts_at)
);

create index if not exists user_bans_active_idx
on public.user_bans (banned_user_id, starts_at, expires_at);

create unique index if not exists notifications_platform_announcement_unique_idx
on public.notifications (user_id, type, href)
where type = 'platform_announcement' and href is not null;

alter table public.platform_announcements enable row level security;
alter table public.user_bans enable row level security;

drop policy if exists "Platform engineers can manage announcements" on public.platform_announcements;
create policy "Platform engineers can manage announcements"
on public.platform_announcements for all
to authenticated
using (public.is_platform_engineer())
with check (public.is_platform_engineer());

drop policy if exists "Platform engineers can manage bans" on public.user_bans;
create policy "Platform engineers can manage bans"
on public.user_bans for all
to authenticated
using (public.is_platform_engineer())
with check (public.is_platform_engineer());

drop policy if exists "Users can read their own active bans" on public.user_bans;
create policy "Users can read their own active bans"
on public.user_bans for select
to authenticated
using (
  auth.uid() = banned_user_id
  and starts_at <= now()
  and expires_at > now()
);

create or replace function public.is_not_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.user_bans
    where user_bans.banned_user_id = auth.uid()
      and user_bans.starts_at <= now()
      and user_bans.expires_at > now()
  );
$$;

drop policy if exists "Authenticated users can create communities" on public.churches;
create policy "Authenticated users can create communities"
on public.churches for insert
to authenticated
with check (
  public.is_not_banned()
  and exists (
    select 1
    from public.profiles
    where profiles.id = churches.created_by
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Owners can create memberships for their communities" on public.church_memberships;
create policy "Owners can create memberships for their communities"
on public.church_memberships for insert
to authenticated
with check (
  public.is_not_banned()
  and (
    exists (
      select 1
      from public.profiles
      where profiles.id = church_memberships.profile_id
        and profiles.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.church_memberships existing_memberships
      join public.profiles on profiles.id = existing_memberships.profile_id
      where existing_memberships.church_id = church_memberships.church_id
        and existing_memberships.role = 'owner'
        and profiles.user_id = auth.uid()
    )
  )
);

drop policy if exists "Authenticated users can create own prayer requests" on public.prayer_requests;
create policy "Authenticated users can create own prayer requests"
on public.prayer_requests for insert
to authenticated
with check (
  public.is_not_banned()
  and exists (
    select 1
    from public.profiles
    where profiles.id = prayer_requests.profile_id
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can create study groups" on public.study_groups;
create policy "Authenticated users can create study groups"
on public.study_groups for insert
to authenticated
with check (
  public.is_not_banned()
  and exists (
    select 1
    from public.profiles
    where profiles.id = study_groups.created_by
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Users can create their own group memberships" on public.group_memberships;
create policy "Users can create their own group memberships"
on public.group_memberships for insert
to authenticated
with check (
  public.is_not_banned()
  and exists (
    select 1
    from public.profiles
    where profiles.id = group_memberships.profile_id
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can create events" on public.events;
create policy "Authenticated users can create events"
on public.events for insert
to authenticated
with check (
  public.is_not_banned()
  and exists (
    select 1
    from public.profiles
    where profiles.id = events.created_by
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Users can create their own event RSVPs" on public.event_rsvps;
create policy "Users can create their own event RSVPs"
on public.event_rsvps for insert
to authenticated
with check (
  public.is_not_banned()
  and auth.uid() = user_id
);

drop policy if exists "Users can update their own event RSVPs" on public.event_rsvps;
create policy "Users can update their own event RSVPs"
on public.event_rsvps for update
to authenticated
using (
  public.is_not_banned()
  and auth.uid() = user_id
)
with check (
  public.is_not_banned()
  and auth.uid() = user_id
);
