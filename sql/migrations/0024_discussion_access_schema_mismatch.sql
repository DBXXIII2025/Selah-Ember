-- Phase 14 discussion access schema mismatch fix.
-- Community ownership is stored directly as churches.created_by = auth.users.id.
-- Community membership is stored through church_memberships.profile_id = profiles.id.

create or replace function public.can_access_community_discussions(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.churches
    where churches.id = target_community_id
      and churches.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.church_memberships
    join public.profiles on profiles.id = church_memberships.profile_id
    where church_memberships.church_id = target_community_id
      and profiles.user_id = auth.uid()
  );
$$;

create or replace function public.can_access_group_discussions(target_group_id uuid)
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
      and study_groups.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.study_groups
    join public.profiles on profiles.id = study_groups.created_by
    where study_groups.id = target_group_id
      and profiles.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.group_memberships
    join public.profiles on profiles.id = group_memberships.profile_id
    where group_memberships.group_id = target_group_id
      and profiles.user_id = auth.uid()
  );
$$;
