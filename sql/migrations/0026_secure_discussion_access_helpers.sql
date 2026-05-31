-- Phase 14 secure discussion access helpers.
-- Uses security-definer RPCs for ownership/member checks without reading protected rows directly in app code.

create or replace function public.is_church_owner_by_user(
  target_church_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.churches
    where churches.id = target_church_id
      and churches.created_by = target_user_id
  );
$$;

create or replace function public.is_group_owner_by_user(
  target_group_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.study_groups
    join public.profiles on profiles.id = study_groups.created_by
    where study_groups.id = target_group_id
      and profiles.user_id = target_user_id
  );
$$;

create or replace function public.is_group_member_by_profile(
  target_group_id uuid,
  target_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_memberships
    where group_memberships.group_id = target_group_id
      and group_memberships.profile_id = target_profile_id
  );
$$;

create or replace function public.can_access_community_discussions(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_church_owner_by_user(target_community_id, auth.uid())
  or exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and public.is_church_member_by_profile(target_community_id, profiles.id)
  );
$$;

create or replace function public.can_access_group_discussions(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_group_owner_by_user(target_group_id, auth.uid())
  or exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and public.is_group_member_by_profile(target_group_id, profiles.id)
  );
$$;
