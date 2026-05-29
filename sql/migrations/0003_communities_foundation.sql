-- Phase 3 community foundation.
-- Extends churches as Selah Ember communities and adds membership ownership.

alter table public.churches
  add column if not exists slug text,
  add column if not exists location text,
  add column if not exists banner_url text,
  add column if not exists is_published boolean not null default true;

create unique index if not exists churches_slug_unique_idx
on public.churches (lower(slug))
where slug is not null and slug <> '';

create table if not exists public.church_memberships (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (church_id, profile_id)
);

alter table public.church_memberships enable row level security;

drop policy if exists "Published communities are publicly readable" on public.churches;
create policy "Published communities are publicly readable"
on public.churches for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Authenticated users can create communities" on public.churches;
create policy "Authenticated users can create communities"
on public.churches for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = churches.created_by
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Owners can update communities" on public.churches;
create policy "Owners can update communities"
on public.churches for update
to authenticated
using (
  exists (
    select 1
    from public.church_memberships
    join public.profiles on profiles.id = church_memberships.profile_id
    where church_memberships.church_id = churches.id
      and church_memberships.role = 'owner'
      and profiles.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.church_memberships
    join public.profiles on profiles.id = church_memberships.profile_id
    where church_memberships.church_id = churches.id
      and church_memberships.role = 'owner'
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Members can read their memberships" on public.church_memberships;
create policy "Members can read their memberships"
on public.church_memberships for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = church_memberships.profile_id
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Owners can create memberships for their communities" on public.church_memberships;
create policy "Owners can create memberships for their communities"
on public.church_memberships for insert
to authenticated
with check (
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
);
