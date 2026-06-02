-- Final group discussion access repair.
-- The app passes explicit auth/profile ids, so this RPC must not depend on auth.uid().

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
      and study_groups.created_by = target_profile_id
  )
  or exists (
    select 1
    from public.group_memberships
    where group_memberships.group_id = target_group_id
      and group_memberships.profile_id = target_profile_id
  );
$$;

grant execute on function public.can_access_group_discussions(uuid, uuid, uuid) to authenticated;
