-- Phase 8 study group membership and discovery.
-- Allows public discovery of public groups and authenticated membership management.

alter table public.study_groups enable row level security;
alter table public.group_memberships enable row level security;

create or replace function public.is_group_owner(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_memberships
    join public.profiles on profiles.id = group_memberships.profile_id
    where group_memberships.group_id = target_group_id
      and group_memberships.role in ('owner', 'leader')
      and profiles.user_id = auth.uid()
  );
$$;

drop policy if exists "Authenticated users can read public study group cards" on public.study_groups;
drop policy if exists "Public can read public study groups" on public.study_groups;
create policy "Public can read public study groups"
on public.study_groups for select
to anon, authenticated
using (is_public = true);

drop policy if exists "Members can read their study groups" on public.study_groups;
create policy "Members can read their study groups"
on public.study_groups for select
to authenticated
using (
  exists (
    select 1
    from public.group_memberships
    join public.profiles on profiles.id = group_memberships.profile_id
    where group_memberships.group_id = study_groups.id
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own group memberships" on public.group_memberships;
drop policy if exists "Members and group owners can read group memberships" on public.group_memberships;
create policy "Members and group owners can read group memberships"
on public.group_memberships for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = group_memberships.profile_id
      and profiles.user_id = auth.uid()
  )
  or public.is_group_owner(group_memberships.group_id)
);

drop policy if exists "Users can create their own group memberships" on public.group_memberships;
create policy "Users can create their own group memberships"
on public.group_memberships for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = group_memberships.profile_id
      and profiles.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their own group memberships" on public.group_memberships;
create policy "Users can delete their own group memberships"
on public.group_memberships for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = group_memberships.profile_id
      and profiles.user_id = auth.uid()
  )
);
