-- Phase 14 discussion membership lookup fix.
-- Community membership is keyed by church_memberships.church_id + church_memberships.profile_id.

create or replace function public.is_church_member_by_profile(
  target_church_id uuid,
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
    from public.profiles
    where profiles.id = target_profile_id
      and profiles.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.church_memberships
    where church_memberships.church_id = target_church_id
      and church_memberships.profile_id = target_profile_id
  );
$$;

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
    from public.profiles
    where profiles.user_id = auth.uid()
      and public.is_church_member_by_profile(target_community_id, profiles.id)
  );
$$;
