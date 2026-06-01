-- Repair and document the canonical identity model:
-- - profiles.id is the ownership/membership key for churches, study_groups, events, media, prayer, and memberships.
-- - profiles.user_id is the bridge to auth.users.id.
-- - auth.users.id remains the author/actor key for auth-owned records such as messages and discussion authors.

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id
  from public.profiles
  where profiles.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.profile_id_for_user(target_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profiles.id
  from public.profiles
  where profiles.user_id = target_user_id
  limit 1;
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select profiles.role
    from public.profiles
    where profiles.user_id = auth.uid()
    limit 1
  ), 'user');
$$;

create or replace function public.is_platform_engineer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'platform_engineer';
$$;

create or replace function public.is_community_owner(target_community_id uuid)
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
      and churches.created_by = public.current_profile_id()
  )
  or exists (
    select 1
    from public.church_memberships
    where church_memberships.church_id = target_community_id
      and church_memberships.profile_id = public.current_profile_id()
      and church_memberships.role = 'owner'
  );
$$;

create or replace function public.is_group_owner(target_group_id uuid)
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
      and study_groups.created_by = public.current_profile_id()
  )
  or exists (
    select 1
    from public.group_memberships
    where group_memberships.group_id = target_group_id
      and group_memberships.profile_id = public.current_profile_id()
      and group_memberships.role in ('owner', 'leader')
  );
$$;

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
      and churches.created_by = public.profile_id_for_user(target_user_id)
  )
  or exists (
    select 1
    from public.church_memberships
    where church_memberships.church_id = target_church_id
      and church_memberships.profile_id = public.profile_id_for_user(target_user_id)
      and church_memberships.role = 'owner'
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
    where study_groups.id = target_group_id
      and study_groups.created_by = public.profile_id_for_user(target_user_id)
  )
  or exists (
    select 1
    from public.group_memberships
    where group_memberships.group_id = target_group_id
      and group_memberships.profile_id = public.profile_id_for_user(target_user_id)
      and group_memberships.role in ('owner', 'leader')
  );
$$;

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
    from public.church_memberships
    where church_memberships.church_id = target_church_id
      and church_memberships.profile_id = target_profile_id
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

create or replace function public.can_manage_community(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_engineer()
    or (
      public.current_profile_role() = 'church_leader'
      and public.is_community_owner(target_community_id)
    );
$$;

create or replace function public.can_manage_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_engineer()
    or public.is_group_owner(target_group_id);
$$;

create or replace function public.can_access_community_discussions(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_community_owner(target_community_id)
    or public.is_church_member_by_profile(target_community_id, public.current_profile_id());
$$;

create or replace function public.can_access_group_discussions(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_group_owner(target_group_id)
    or public.is_group_member_by_profile(target_group_id, public.current_profile_id());
$$;

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
      and churches.created_by = target_profile_id
      and target_profile_id = public.profile_id_for_user(target_auth_user_id)
  )
  or public.is_church_member_by_profile(target_church_id, target_profile_id);
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
      and study_groups.created_by = target_profile_id
      and target_profile_id = public.profile_id_for_user(target_auth_user_id)
  )
  or public.is_group_member_by_profile(target_group_id, target_profile_id);
$$;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.profile_id_for_user(uuid) to authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_platform_engineer() to authenticated;
grant execute on function public.is_community_owner(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.is_church_owner_by_user(uuid, uuid) to authenticated;
grant execute on function public.is_group_owner_by_user(uuid, uuid) to authenticated;
grant execute on function public.is_church_member_by_profile(uuid, uuid) to authenticated;
grant execute on function public.is_group_member_by_profile(uuid, uuid) to authenticated;
grant execute on function public.can_manage_community(uuid) to authenticated;
grant execute on function public.can_manage_group(uuid) to authenticated;
grant execute on function public.can_access_community_discussions(uuid) to authenticated;
grant execute on function public.can_access_group_discussions(uuid) to authenticated;
grant execute on function public.can_access_community_discussions(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_access_group_discussions(uuid, uuid, uuid) to authenticated;
