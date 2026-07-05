-- Phase 17 critical authorization hardening.
-- Preserves existing platform engineers and privileged memberships while
-- preventing callers from assigning those privileges through generic writes.

-- The original owner policy predates the role column and therefore allowed a
-- user to update their own role. Restrict direct profile updates to public
-- profile fields, and add a trigger as defense in depth for protected identity
-- fields reached through any authenticated SQL path.
revoke update on table public.profiles from authenticated;
grant update (
  display_name,
  avatar_url,
  bio,
  username,
  favorite_verse,
  church_name
) on table public.profiles to authenticated;

create or replace function public.prevent_authenticated_profile_privilege_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and auth.uid() is not null
    and (
    new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.role is distinct from old.role
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Authenticated profile updates cannot change protected identity fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_authenticated_profile_privilege_update on public.profiles;
create trigger prevent_authenticated_profile_privilege_update
before update on public.profiles
for each row execute function public.prevent_authenticated_profile_privilege_update();

-- Constrain all future membership rows to recognized roles without rewriting
-- or silently legitimizing existing production rows. Validate these constraints
-- after the manual existing-membership review documented in the audit.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.church_memberships'::regclass
      and conname = 'church_memberships_role_check'
  ) then
    alter table public.church_memberships
      add constraint church_memberships_role_check
      check (role in ('member', 'owner', 'leader')) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.group_memberships'::regclass
      and conname = 'group_memberships_role_check'
  ) then
    alter table public.group_memberships
      add constraint group_memberships_role_check
      check (role in ('member', 'owner', 'leader')) not valid;
  end if;
end $$;

-- Self-service joins may create only ordinary member rows. Privileged role
-- assignment remains a trusted service-side operation after authorization.
drop policy if exists "Owners can create memberships for their communities" on public.church_memberships;
drop policy if exists "Users can create their own memberships" on public.church_memberships;
drop policy if exists "Users can create member community memberships" on public.church_memberships;
create policy "Users can create member community memberships"
on public.church_memberships for insert
to authenticated
with check (
  public.is_not_banned()
  and role = 'member'
  and profile_id = public.current_profile_id()
);

drop policy if exists "Users can create their own group memberships" on public.group_memberships;
drop policy if exists "Users can create member group memberships" on public.group_memberships;
create policy "Users can create member group memberships"
on public.group_memberships for insert
to authenticated
with check (
  public.is_not_banned()
  and role = 'member'
  and profile_id = public.current_profile_id()
);
