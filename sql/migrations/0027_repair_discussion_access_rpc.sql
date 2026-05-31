-- Phase 14 RPC repair.
-- Access checks now accept the auth user id and profile id explicitly so the app does not depend on auth.uid().

create or replace function public.can_access_community_discussions(
  target_church_id uuid,
  target_auth_user_id uuid,
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
    from public.churches
    where churches.id = target_church_id
      and churches.created_by = target_auth_user_id
  )
  or exists (
    select 1
    from public.church_memberships
    where church_memberships.church_id = target_church_id
      and church_memberships.profile_id = target_profile_id
  );
$$;

create or replace function public.can_access_group_discussions(
  target_group_id uuid,
  target_auth_user_id uuid,
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
    from public.study_groups
    where study_groups.id = target_group_id
      and study_groups.created_by = target_auth_user_id
  )
  or exists (
    select 1
    from public.group_memberships
    where group_memberships.group_id = target_group_id
      and group_memberships.profile_id = target_profile_id
  );
$$;

grant execute on function public.can_access_community_discussions(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_access_group_discussions(uuid, uuid, uuid) to authenticated;
