-- Phase 13 platform engineer foundation.
-- Role values: user, church_owner, platform_engineer.

alter table public.profiles
  add column if not exists role text not null default 'user';

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'profiles'
      and constraint_name = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('user', 'church_owner', 'platform_engineer'));
  end if;
end $$;

update public.profiles
set role = 'platform_engineer'
where (select count(*) from public.profiles) = 1
  and role <> 'platform_engineer';

-- If more than one profile exists, do not guess. Identify profiles, then manually update one:
-- select profiles.user_id, profiles.display_name, auth.users.email, profiles.role
-- from public.profiles
-- left join auth.users on auth.users.id = profiles.user_id
-- order by profiles.created_at asc;
--
-- update public.profiles
-- set role = 'platform_engineer'
-- where user_id = '<chosen-auth-user-id>';

create or replace function public.is_platform_engineer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.user_id = auth.uid()
      and profiles.role = 'platform_engineer'
  );
$$;

drop policy if exists "Platform engineers can read profiles" on public.profiles;
create policy "Platform engineers can read profiles"
on public.profiles for select
to authenticated
using (public.is_platform_engineer());
