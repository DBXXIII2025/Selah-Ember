-- Study Rooms Phase B hardening.
-- Delta-only migration for development databases where 0039_study_rooms.sql
-- was applied before the Phase B hardening pass.

create or replace function public.enforce_study_room_owner_consistency()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  target_room_id uuid;
  expected_owner_profile_id uuid;
  target_status text;
  owner_count integer;
  matching_owner_count integer;
begin
  if tg_table_name = 'study_rooms' then
    target_room_id := coalesce(new.id, old.id);
  else
    target_room_id := coalesce(new.room_id, old.room_id);
  end if;

  if target_room_id is null then
    return coalesce(new, old);
  end if;

  select owner_profile_id, status
  into expected_owner_profile_id, target_status
  from public.study_rooms
  where id = target_room_id;

  if not found then
    return coalesce(new, old);
  end if;

  select
    count(*) filter (where role = 'owner'),
    count(*) filter (where role = 'owner' and profile_id = expected_owner_profile_id)
  into owner_count, matching_owner_count
  from public.study_room_members
  where room_id = target_room_id;

  if expected_owner_profile_id is null then
    if target_status <> 'archived' then
      raise exception 'Active or completed Study Rooms must have an owner'
        using errcode = '23514';
    end if;

    if owner_count <> 0 then
      raise exception 'Archived Study Room with no owner_profile_id cannot have owner membership'
        using errcode = '23514';
    end if;
  elsif owner_count <> 1 or matching_owner_count <> 1 then
    raise exception 'Study Room owner_profile_id must match exactly one owner membership'
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists enforce_study_room_owner_consistency_room on public.study_rooms;
create constraint trigger enforce_study_room_owner_consistency_room
after insert or update of owner_profile_id, status or delete on public.study_rooms
deferrable initially deferred
for each row execute function public.enforce_study_room_owner_consistency();

drop trigger if exists enforce_study_room_owner_consistency_member on public.study_room_members;
create constraint trigger enforce_study_room_owner_consistency_member
after insert or update of room_id, profile_id, role or delete on public.study_room_members
deferrable initially deferred
for each row execute function public.enforce_study_room_owner_consistency();

create or replace function public.create_study_room_with_owner(
  room_name text,
  room_description text,
  room_cover_image_url text,
  room_study_topic text,
  room_primary_bible_book text,
  room_current_scripture_reference text,
  room_pinned_scripture_reference text,
  room_visibility text,
  room_membership_mode text,
  owner_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_room_id uuid;
begin
  if owner_profile_id is null then
    raise exception 'owner_profile_id is required'
      using errcode = '23502';
  end if;

  insert into public.study_rooms (
    name,
    description,
    cover_image_url,
    study_topic,
    primary_bible_book,
    current_scripture_reference,
    pinned_scripture_reference,
    visibility,
    membership_mode,
    status,
    owner_profile_id
  )
  values (
    room_name,
    room_description,
    room_cover_image_url,
    room_study_topic,
    room_primary_bible_book,
    room_current_scripture_reference,
    room_pinned_scripture_reference,
    room_visibility,
    room_membership_mode,
    'active',
    owner_profile_id
  )
  returning id into created_room_id;

  insert into public.study_room_members (room_id, profile_id, role)
  values (created_room_id, owner_profile_id, 'owner');

  return created_room_id;
end;
$$;

revoke execute on function public.create_study_room_with_owner(
  text, text, text, text, text, text, text, text, text, uuid
) from public;
revoke execute on function public.create_study_room_with_owner(
  text, text, text, text, text, text, text, text, text, uuid
) from anon;
revoke execute on function public.create_study_room_with_owner(
  text, text, text, text, text, text, text, text, text, uuid
) from authenticated;
grant execute on function public.create_study_room_with_owner(
  text, text, text, text, text, text, text, text, text, uuid
) to service_role;

create or replace function public.transfer_study_room_ownership(
  target_room_id uuid,
  new_owner_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_room_id is null or new_owner_profile_id is null then
    raise exception 'target_room_id and new_owner_profile_id are required'
      using errcode = '23502';
  end if;

  if not exists (
    select 1
    from public.study_room_members
    where room_id = target_room_id
      and profile_id = new_owner_profile_id
  ) then
    raise exception 'New owner must already be a Study Room member'
      using errcode = '23503';
  end if;

  update public.study_room_members
  set role = 'leader'
  where room_id = target_room_id
    and role = 'owner'
    and profile_id <> new_owner_profile_id;

  update public.study_room_members
  set role = 'owner'
  where room_id = target_room_id
    and profile_id = new_owner_profile_id;

  update public.study_rooms
  set owner_profile_id = new_owner_profile_id
  where id = target_room_id;

  if not found then
    raise exception 'Study Room not found'
      using errcode = '23503';
  end if;
end;
$$;

revoke execute on function public.transfer_study_room_ownership(uuid, uuid) from public;
revoke execute on function public.transfer_study_room_ownership(uuid, uuid) from anon;
revoke execute on function public.transfer_study_room_ownership(uuid, uuid) from authenticated;
grant execute on function public.transfer_study_room_ownership(uuid, uuid) to service_role;

create or replace function public.review_study_room_join_request(
  target_request_id uuid,
  reviewer_profile_id uuid,
  approve_request boolean
)
returns table (
  request_room_id uuid,
  request_profile_id uuid,
  request_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_request public.study_room_join_requests%rowtype;
  next_status text;
begin
  if target_request_id is null or reviewer_profile_id is null then
    raise exception 'target_request_id and reviewer_profile_id are required'
      using errcode = '23502';
  end if;

  select *
  into locked_request
  from public.study_room_join_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception 'Study Room join request not found'
      using errcode = '23503';
  end if;

  if locked_request.status <> 'pending' then
    raise exception 'Study Room join request is no longer pending'
      using errcode = '23514';
  end if;

  next_status := case when approve_request then 'approved' else 'denied' end;

  update public.study_room_join_requests
  set status = next_status,
      reviewed_by_profile_id = reviewer_profile_id,
      reviewed_at = now()
  where id = target_request_id;

  if approve_request then
    insert into public.study_room_members (room_id, profile_id, role)
    values (locked_request.room_id, locked_request.profile_id, 'member')
    on conflict (room_id, profile_id) do nothing;
  end if;

  request_room_id := locked_request.room_id;
  request_profile_id := locked_request.profile_id;
  request_status := next_status;
  return next;
end;
$$;

revoke execute on function public.review_study_room_join_request(uuid, uuid, boolean) from public;
revoke execute on function public.review_study_room_join_request(uuid, uuid, boolean) from anon;
revoke execute on function public.review_study_room_join_request(uuid, uuid, boolean) from authenticated;
grant execute on function public.review_study_room_join_request(uuid, uuid, boolean) to service_role;

create or replace function public.can_read_study_room(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_engineer()
    or exists (
      select 1
      from public.study_rooms
      where study_rooms.id = target_room_id
        and study_rooms.status <> 'archived'
        and (
          study_rooms.visibility in ('public', 'unlisted')
          or public.is_study_room_member(target_room_id)
        )
    );
$$;

create or replace function public.can_lead_study_room(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_engineer()
    or exists (
      select 1
      from public.study_rooms
      where study_rooms.id = target_room_id
        and study_rooms.status <> 'archived'
        and public.study_room_role(target_room_id) in ('owner', 'leader')
    );
$$;

create or replace function public.can_manage_study_room(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_engineer()
    or exists (
      select 1
      from public.study_rooms
      where study_rooms.id = target_room_id
        and study_rooms.status <> 'archived'
        and public.study_room_role(target_room_id) = 'owner'
    );
$$;

grant execute on function public.can_read_study_room(uuid) to anon, authenticated;
grant execute on function public.can_lead_study_room(uuid) to authenticated;
grant execute on function public.can_manage_study_room(uuid) to authenticated;

drop policy if exists "Users can join open study rooms" on public.study_room_members;
create policy "Users can join open study rooms"
on public.study_room_members for insert
to authenticated
with check (
  public.is_not_banned()
  and profile_id = public.current_profile_id()
  and role = 'member'
  and exists (
    select 1
    from public.study_rooms
    where study_rooms.id = study_room_members.room_id
      and study_rooms.membership_mode = 'open_join'
      and study_rooms.status = 'active'
      and study_rooms.visibility in ('public', 'unlisted')
  )
);

drop policy if exists "Members can create study room notes" on public.study_room_notes;
create policy "Members can create study room notes"
on public.study_room_notes for insert
to authenticated
with check (
  public.is_not_banned()
  and author_user_id = auth.uid()
  and public.is_study_room_member(room_id)
  and public.can_read_study_room(room_id)
);

drop policy if exists "Authors and moderators can update study room notes" on public.study_room_notes;
create policy "Authors and moderators can update study room notes"
on public.study_room_notes for update
to authenticated
using ((author_user_id = auth.uid() and public.is_not_banned()) or public.can_moderate_study_room(room_id))
with check ((author_user_id = auth.uid() and public.is_not_banned()) or public.can_moderate_study_room(room_id));

drop policy if exists "Members can create study room discussion threads" on public.study_room_discussion_threads;
create policy "Members can create study room discussion threads"
on public.study_room_discussion_threads for insert
to authenticated
with check (
  public.is_not_banned()
  and author_user_id = auth.uid()
  and public.is_study_room_member(room_id)
  and public.can_read_study_room(room_id)
);

drop policy if exists "Authors and moderators can update study room discussion threads" on public.study_room_discussion_threads;
create policy "Authors and moderators can update study room discussion threads"
on public.study_room_discussion_threads for update
to authenticated
using ((author_user_id = auth.uid() and public.is_not_banned()) or public.can_moderate_study_room(room_id))
with check ((author_user_id = auth.uid() and public.is_not_banned()) or public.can_moderate_study_room(room_id));

drop policy if exists "Authors and moderators can update study room discussion replies" on public.study_room_discussion_replies;
create policy "Authors and moderators can update study room discussion replies"
on public.study_room_discussion_replies for update
to authenticated
using (
  (author_user_id = auth.uid() and public.is_not_banned())
  or exists (
    select 1
    from public.study_room_discussion_threads
    where study_room_discussion_threads.id = study_room_discussion_replies.thread_id
      and public.can_moderate_study_room(study_room_discussion_threads.room_id)
  )
)
with check (
  (author_user_id = auth.uid() and public.is_not_banned())
  or exists (
    select 1
    from public.study_room_discussion_threads
    where study_room_discussion_threads.id = study_room_discussion_replies.thread_id
      and public.can_moderate_study_room(study_room_discussion_threads.room_id)
  )
);

drop policy if exists "Members can create study room prayer requests" on public.study_room_prayer_requests;
create policy "Members can create study room prayer requests"
on public.study_room_prayer_requests for insert
to authenticated
with check (
  public.is_not_banned()
  and author_user_id = auth.uid()
  and public.is_study_room_member(room_id)
  and public.can_read_study_room(room_id)
);

drop policy if exists "Authors and moderators can update study room prayer requests" on public.study_room_prayer_requests;
create policy "Authors and moderators can update study room prayer requests"
on public.study_room_prayer_requests for update
to authenticated
using ((author_user_id = auth.uid() and public.is_not_banned()) or public.can_moderate_study_room(room_id))
with check ((author_user_id = auth.uid() and public.is_not_banned()) or public.can_moderate_study_room(room_id));

drop policy if exists "Members can manage own study room prayer support" on public.study_room_prayer_support;
create policy "Members can manage own study room prayer support"
on public.study_room_prayer_support for all
to authenticated
using (profile_id = public.current_profile_id())
with check (
  public.is_not_banned()
  and profile_id = public.current_profile_id()
  and exists (
    select 1
    from public.study_room_prayer_requests
    where study_room_prayer_requests.id = study_room_prayer_support.prayer_request_id
      and public.is_study_room_member(study_room_prayer_requests.room_id)
      and public.can_read_study_room(study_room_prayer_requests.room_id)
  )
);

drop policy if exists "Members can create study room reports" on public.study_room_reports;
create policy "Members can create study room reports"
on public.study_room_reports for insert
to authenticated
with check (
  public.is_not_banned()
  and reporter_user_id = auth.uid()
  and public.can_read_study_room(room_id)
);
