-- Phase 7 community membership and discovery.
-- Keeps community discovery public while letting members manage their own non-owner membership.

alter table public.churches enable row level security;
alter table public.church_memberships enable row level security;

create or replace function public.is_community_owner(community_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.church_memberships
    join public.profiles on profiles.id = church_memberships.profile_id
    where church_memberships.church_id = community_id
      and church_memberships.role = 'owner'
      and profiles.user_id = auth.uid()
  );
$$;

drop policy if exists "Published communities are publicly readable" on public.churches;
create policy "Published communities are publicly readable"
on public.churches for select
to anon, authenticated
using (is_published = true);

drop policy if exists "Members can read their memberships" on public.church_memberships;
drop policy if exists "Members and community owners can read memberships" on public.church_memberships;
create policy "Members and community owners can read memberships"
on public.church_memberships for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = church_memberships.profile_id
      and profiles.user_id = auth.uid()
  )
  or public.is_community_owner(church_memberships.church_id)
);

drop policy if exists "Owners can create memberships for their communities" on public.church_memberships;
drop policy if exists "Users can create their own memberships" on public.church_memberships;
create policy "Users can create their own memberships"
on public.church_memberships for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = church_memberships.profile_id
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their own non-owner memberships" on public.church_memberships;
create policy "Users can delete their own non-owner memberships"
on public.church_memberships for delete
to authenticated
using (
  role <> 'owner'
  and exists (
    select 1
    from public.profiles
    where profiles.id = church_memberships.profile_id
      and profiles.user_id = auth.uid()
  )
);
