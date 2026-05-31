-- Phase 14 discussion access fix.
-- Owners/creators can access discussions even if their membership row is missing.

create or replace function public.can_access_community_discussions(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.church_memberships
    join public.profiles on profiles.id = church_memberships.profile_id
    where church_memberships.church_id = target_community_id
      and profiles.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.churches
    join public.profiles on profiles.id = churches.created_by
    where churches.id = target_community_id
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
    from public.group_memberships
    join public.profiles on profiles.id = group_memberships.profile_id
    where group_memberships.group_id = target_group_id
      and profiles.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.study_groups
    join public.profiles on profiles.id = study_groups.created_by
    where study_groups.id = target_group_id
      and profiles.user_id = auth.uid()
  );
$$;

create or replace function public.can_read_discussion_thread(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.discussion_threads
    where discussion_threads.id = target_thread_id
      and (
        (discussion_threads.scope_type = 'community' and public.can_access_community_discussions(discussion_threads.community_id))
        or (discussion_threads.scope_type = 'group' and public.can_access_group_discussions(discussion_threads.group_id))
      )
  );
$$;

drop policy if exists "Members can read discussion threads" on public.discussion_threads;
create policy "Members can read discussion threads"
on public.discussion_threads for select
to authenticated
using (
  (scope_type = 'community' and public.can_access_community_discussions(community_id))
  or (scope_type = 'group' and public.can_access_group_discussions(group_id))
);

drop policy if exists "Members can create discussion threads" on public.discussion_threads;
create policy "Members can create discussion threads"
on public.discussion_threads for insert
to authenticated
with check (
  public.is_not_banned()
  and auth.uid() = author_id
  and (
    (scope_type = 'community' and public.can_access_community_discussions(community_id))
    or (scope_type = 'group' and public.can_access_group_discussions(group_id))
  )
);
