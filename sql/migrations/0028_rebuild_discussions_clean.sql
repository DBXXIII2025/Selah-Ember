-- Emergency rebuild for discussions access.
-- Keeps historical migrations intact and replaces access helpers with explicit, testable RPCs.

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
      and churches.created_by = public.profile_id_for_user(target_auth_user_id)
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
      and study_groups.created_by = public.profile_id_for_user(target_auth_user_id)
  )
  or public.is_group_member_by_profile(target_group_id, target_profile_id);
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
        (
          discussion_threads.scope_type = 'community'
          and public.can_access_community_discussions(
            discussion_threads.community_id,
            auth.uid(),
            public.profile_id_for_user(auth.uid())
          )
        )
        or (
          discussion_threads.scope_type = 'group'
          and public.can_access_group_discussions(
            discussion_threads.group_id,
            auth.uid(),
            public.profile_id_for_user(auth.uid())
          )
        )
      )
  );
$$;

grant execute on function public.profile_id_for_user(uuid) to authenticated;
grant execute on function public.is_church_member_by_profile(uuid, uuid) to authenticated;
grant execute on function public.is_group_member_by_profile(uuid, uuid) to authenticated;
grant execute on function public.can_access_community_discussions(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_access_group_discussions(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_read_discussion_thread(uuid) to authenticated;

drop policy if exists "Members can read discussion threads" on public.discussion_threads;
create policy "Members can read discussion threads"
on public.discussion_threads for select
to authenticated
using (public.can_read_discussion_thread(id));

drop policy if exists "Members can create discussion threads" on public.discussion_threads;
create policy "Members can create discussion threads"
on public.discussion_threads for insert
to authenticated
with check (
  public.is_not_banned()
  and auth.uid() = author_id
  and (
    (
      scope_type = 'community'
      and public.can_access_community_discussions(community_id, auth.uid(), public.profile_id_for_user(auth.uid()))
    )
    or (
      scope_type = 'group'
      and public.can_access_group_discussions(group_id, auth.uid(), public.profile_id_for_user(auth.uid()))
    )
  )
);

drop policy if exists "Authors can soft delete own discussion threads" on public.discussion_threads;
create policy "Authors can soft delete own discussion threads"
on public.discussion_threads for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "Members can read discussion replies" on public.discussion_replies;
create policy "Members can read discussion replies"
on public.discussion_replies for select
to authenticated
using (public.can_read_discussion_thread(thread_id));

drop policy if exists "Members can create discussion replies" on public.discussion_replies;
create policy "Members can create discussion replies"
on public.discussion_replies for insert
to authenticated
with check (
  public.is_not_banned()
  and auth.uid() = author_id
  and public.can_read_discussion_thread(thread_id)
  and exists (
    select 1
    from public.discussion_threads
    where discussion_threads.id = discussion_replies.thread_id
      and discussion_threads.deleted_at is null
  )
);

drop policy if exists "Authors can soft delete own discussion replies" on public.discussion_replies;
create policy "Authors can soft delete own discussion replies"
on public.discussion_replies for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "Members can create discussion reports" on public.discussion_reports;
create policy "Members can create discussion reports"
on public.discussion_reports for insert
to authenticated
with check (
  public.can_read_discussion_thread(coalesce(thread_id, (
    select discussion_replies.thread_id
    from public.discussion_replies
    where discussion_replies.id = reply_id
  )))
);

drop policy if exists "Users can read own discussion reports" on public.discussion_reports;
create policy "Users can read own discussion reports"
on public.discussion_reports for select
to authenticated
using (reporter_id = auth.uid());

drop policy if exists "Platform engineers can read discussion reports" on public.discussion_reports;
create policy "Platform engineers can read discussion reports"
on public.discussion_reports for select
to authenticated
using (public.is_platform_engineer());
