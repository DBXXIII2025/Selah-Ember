-- Study Rooms foundation.
-- Structured Bible study rooms are intentionally separate from fellowship-oriented study_groups.
-- Identity model:
-- - profiles.id is used for room ownership, membership, invitations, requests, and progress.
-- - auth.users.id is used for authored content and notification actors.

create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  cover_image_url text,
  study_topic text,
  primary_bible_book text,
  current_scripture_reference text,
  pinned_scripture_reference text,
  visibility text not null default 'public',
  membership_mode text not null default 'open_join',
  status text not null default 'active',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_rooms_name_not_blank check (length(btrim(name)) > 0),
  constraint study_rooms_name_length check (char_length(name) <= 120),
  constraint study_rooms_description_not_blank check (length(btrim(description)) > 0),
  constraint study_rooms_description_length check (char_length(description) <= 5000),
  constraint study_rooms_cover_url_length check (cover_image_url is null or char_length(cover_image_url) <= 2048),
  constraint study_rooms_study_topic_length check (study_topic is null or char_length(study_topic) <= 160),
  constraint study_rooms_primary_bible_book_length check (primary_bible_book is null or char_length(primary_bible_book) <= 80),
  constraint study_rooms_current_scripture_length check (current_scripture_reference is null or char_length(current_scripture_reference) <= 160),
  constraint study_rooms_pinned_scripture_length check (pinned_scripture_reference is null or char_length(pinned_scripture_reference) <= 160),
  constraint study_rooms_visibility_check check (visibility in ('public', 'private', 'unlisted')),
  constraint study_rooms_membership_mode_check check (membership_mode in ('open_join', 'request_to_join', 'invite_only')),
  constraint study_rooms_status_check check (status in ('active', 'completed', 'archived'))
);

create table if not exists public.study_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, profile_id),
  constraint study_room_members_role_check check (role in ('owner', 'leader', 'moderator', 'member'))
);

create table if not exists public.study_room_join_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  message text,
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_room_join_requests_status_check check (status in ('pending', 'approved', 'denied', 'canceled')),
  constraint study_room_join_requests_message_length check (message is null or char_length(message) <= 1000)
);

create table if not exists public.study_room_invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  invited_profile_id uuid not null references public.profiles(id) on delete cascade,
  invited_by_profile_id uuid references public.profiles(id) on delete set null,
  role text not null default 'member',
  status text not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint study_room_invitations_role_check check (role in ('leader', 'moderator', 'member')),
  constraint study_room_invitations_status_check check (status in ('pending', 'accepted', 'declined', 'revoked')),
  constraint study_room_invitations_message_length check (message is null or char_length(message) <= 1000)
);

create table if not exists public.study_room_studies (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  title text not null,
  description text,
  scripture_reference text,
  study_number integer,
  scheduled_at timestamptz,
  status text not null default 'draft',
  leader_notes text,
  closing_reflection text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_room_studies_title_not_blank check (length(btrim(title)) > 0),
  constraint study_room_studies_title_length check (char_length(title) <= 160),
  constraint study_room_studies_description_length check (description is null or char_length(description) <= 10000),
  constraint study_room_studies_scripture_length check (scripture_reference is null or char_length(scripture_reference) <= 160),
  constraint study_room_studies_number_positive check (study_number is null or study_number > 0),
  constraint study_room_studies_status_check check (status in ('draft', 'upcoming', 'active', 'completed'))
);

create table if not exists public.study_room_study_progress (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.study_room_studies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'not_started',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (study_id, profile_id),
  constraint study_room_study_progress_status_check check (status in ('not_started', 'in_progress', 'completed'))
);

create table if not exists public.study_room_notes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  study_id uuid references public.study_room_studies(id) on delete set null,
  author_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text not null,
  scripture_reference text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_room_notes_title_not_blank check (length(btrim(title)) > 0),
  constraint study_room_notes_title_length check (char_length(title) <= 160),
  constraint study_room_notes_body_not_blank check (length(btrim(body)) > 0),
  constraint study_room_notes_body_length check (char_length(body) <= 20000),
  constraint study_room_notes_scripture_length check (scripture_reference is null or char_length(scripture_reference) <= 160)
);

create table if not exists public.study_room_discussion_threads (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  study_id uuid references public.study_room_studies(id) on delete set null,
  author_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_room_discussion_threads_title_not_blank check (length(btrim(title)) > 0),
  constraint study_room_discussion_threads_title_length check (char_length(title) <= 160),
  constraint study_room_discussion_threads_body_not_blank check (length(btrim(body)) > 0),
  constraint study_room_discussion_threads_body_length check (char_length(body) <= 20000)
);

create table if not exists public.study_room_discussion_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.study_room_discussion_threads(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_room_discussion_replies_body_not_blank check (length(btrim(body)) > 0),
  constraint study_room_discussion_replies_body_length check (char_length(body) <= 20000)
);

create table if not exists public.study_room_prayer_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  study_id uuid references public.study_room_studies(id) on delete set null,
  author_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text not null,
  category text not null default 'other',
  status text not null default 'active',
  answered_at timestamptz,
  answered_update text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_room_prayer_title_not_blank check (length(btrim(title)) > 0),
  constraint study_room_prayer_title_length check (char_length(title) <= 160),
  constraint study_room_prayer_body_not_blank check (length(btrim(body)) > 0),
  constraint study_room_prayer_body_length check (char_length(body) <= 10000),
  constraint study_room_prayer_category_check check (category in ('praise', 'healing', 'family', 'church', 'work', 'salvation', 'other')),
  constraint study_room_prayer_status_check check (status in ('active', 'answered', 'removed')),
  constraint study_room_prayer_answered_update_length check (answered_update is null or char_length(answered_update) <= 10000)
);

create table if not exists public.study_room_prayer_support (
  id uuid primary key default gen_random_uuid(),
  prayer_request_id uuid not null references public.study_room_prayer_requests(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (prayer_request_id, profile_id)
);

create table if not exists public.study_room_resources (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  study_id uuid references public.study_room_studies(id) on delete set null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  external_url text not null,
  resource_type text not null default 'external_link',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_room_resources_title_not_blank check (length(btrim(title)) > 0),
  constraint study_room_resources_title_length check (char_length(title) <= 160),
  constraint study_room_resources_description_length check (description is null or char_length(description) <= 5000),
  constraint study_room_resources_url_not_blank check (length(btrim(external_url)) > 0),
  constraint study_room_resources_url_length check (char_length(external_url) <= 2048),
  constraint study_room_resources_url_protocol check (external_url ~* '^https?://'),
  constraint study_room_resources_type_check check (resource_type in ('article', 'video', 'pdf', 'study_guide', 'external_link', 'other'))
);

create table if not exists public.study_room_bookmarks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  note_id uuid references public.study_room_notes(id) on delete cascade,
  thread_id uuid references public.study_room_discussion_threads(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint study_room_bookmarks_target_check check (
    (note_id is not null and thread_id is null)
    or (note_id is null and thread_id is not null)
  ),
  unique (profile_id, note_id),
  unique (profile_id, thread_id)
);

create table if not exists public.study_room_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  note_id uuid references public.study_room_notes(id) on delete set null,
  thread_id uuid references public.study_room_discussion_threads(id) on delete set null,
  reply_id uuid references public.study_room_discussion_replies(id) on delete set null,
  prayer_request_id uuid references public.study_room_prayer_requests(id) on delete set null,
  resource_id uuid references public.study_room_resources(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open',
  reviewed_by_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint study_room_reports_target_check check (
    num_nonnulls(note_id, thread_id, reply_id, prayer_request_id, resource_id) = 1
  ),
  constraint study_room_reports_reason_not_blank check (length(btrim(reason)) > 0),
  constraint study_room_reports_reason_length check (char_length(reason) <= 160),
  constraint study_room_reports_details_length check (details is null or char_length(details) <= 1000),
  constraint study_room_reports_status_check check (status in ('open', 'reviewed', 'resolved', 'dismissed'))
);

create index if not exists study_rooms_discovery_idx
on public.study_rooms (visibility, status, updated_at desc);

create index if not exists study_rooms_owner_idx
on public.study_rooms (owner_profile_id, status, updated_at desc);

create index if not exists study_room_members_profile_idx
on public.study_room_members (profile_id, updated_at desc);

create index if not exists study_room_members_room_role_idx
on public.study_room_members (room_id, role);

create unique index if not exists study_room_join_requests_pending_unique_idx
on public.study_room_join_requests (room_id, profile_id)
where status = 'pending';

create unique index if not exists study_room_invitations_pending_unique_idx
on public.study_room_invitations (room_id, invited_profile_id)
where status = 'pending';

create index if not exists study_room_studies_room_order_idx
on public.study_room_studies (room_id, (coalesce(study_number, 2147483647)), scheduled_at, created_at);

create index if not exists study_room_study_progress_profile_idx
on public.study_room_study_progress (profile_id, updated_at desc);

create index if not exists study_room_notes_room_idx
on public.study_room_notes (room_id, updated_at desc);

create index if not exists study_room_notes_study_idx
on public.study_room_notes (study_id, updated_at desc);

create index if not exists study_room_discussion_threads_room_idx
on public.study_room_discussion_threads (room_id, is_pinned desc, updated_at desc);

create index if not exists study_room_discussion_replies_thread_idx
on public.study_room_discussion_replies (thread_id, created_at);

create index if not exists study_room_prayer_room_idx
on public.study_room_prayer_requests (room_id, status, updated_at desc);

create index if not exists study_room_resources_room_type_idx
on public.study_room_resources (room_id, resource_type, updated_at desc);

create index if not exists study_room_bookmarks_profile_idx
on public.study_room_bookmarks (profile_id, created_at desc);

create index if not exists study_room_reports_status_idx
on public.study_room_reports (status, created_at desc);

create index if not exists study_room_reports_room_idx
on public.study_room_reports (room_id, created_at desc);

drop trigger if exists set_study_rooms_updated_at on public.study_rooms;
create trigger set_study_rooms_updated_at
before update on public.study_rooms
for each row execute function public.set_updated_at();

drop trigger if exists set_study_room_members_updated_at on public.study_room_members;
create trigger set_study_room_members_updated_at
before update on public.study_room_members
for each row execute function public.set_updated_at();

drop trigger if exists set_study_room_join_requests_updated_at on public.study_room_join_requests;
create trigger set_study_room_join_requests_updated_at
before update on public.study_room_join_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_study_room_invitations_updated_at on public.study_room_invitations;
create trigger set_study_room_invitations_updated_at
before update on public.study_room_invitations
for each row execute function public.set_updated_at();

drop trigger if exists set_study_room_studies_updated_at on public.study_room_studies;
create trigger set_study_room_studies_updated_at
before update on public.study_room_studies
for each row execute function public.set_updated_at();

drop trigger if exists set_study_room_study_progress_updated_at on public.study_room_study_progress;
create trigger set_study_room_study_progress_updated_at
before update on public.study_room_study_progress
for each row execute function public.set_updated_at();

drop trigger if exists set_study_room_notes_updated_at on public.study_room_notes;
create trigger set_study_room_notes_updated_at
before update on public.study_room_notes
for each row execute function public.set_updated_at();

drop trigger if exists set_study_room_discussion_threads_updated_at on public.study_room_discussion_threads;
create trigger set_study_room_discussion_threads_updated_at
before update on public.study_room_discussion_threads
for each row execute function public.set_updated_at();

drop trigger if exists set_study_room_discussion_replies_updated_at on public.study_room_discussion_replies;
create trigger set_study_room_discussion_replies_updated_at
before update on public.study_room_discussion_replies
for each row execute function public.set_updated_at();

drop trigger if exists set_study_room_prayer_requests_updated_at on public.study_room_prayer_requests;
create trigger set_study_room_prayer_requests_updated_at
before update on public.study_room_prayer_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_study_room_resources_updated_at on public.study_room_resources;
create trigger set_study_room_resources_updated_at
before update on public.study_room_resources
for each row execute function public.set_updated_at();

create or replace function public.enforce_study_room_scoped_study()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  scoped_room_id uuid;
begin
  if new.study_id is null then
    return new;
  end if;

  select room_id
  into scoped_room_id
  from public.study_room_studies
  where id = new.study_id;

  if scoped_room_id is null or scoped_room_id <> new.room_id then
    raise exception 'Study does not belong to this Study Room'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_study_room_note_study_scope on public.study_room_notes;
create trigger enforce_study_room_note_study_scope
before insert or update of room_id, study_id on public.study_room_notes
for each row execute function public.enforce_study_room_scoped_study();

drop trigger if exists enforce_study_room_thread_study_scope on public.study_room_discussion_threads;
create trigger enforce_study_room_thread_study_scope
before insert or update of room_id, study_id on public.study_room_discussion_threads
for each row execute function public.enforce_study_room_scoped_study();

drop trigger if exists enforce_study_room_prayer_study_scope on public.study_room_prayer_requests;
create trigger enforce_study_room_prayer_study_scope
before insert or update of room_id, study_id on public.study_room_prayer_requests
for each row execute function public.enforce_study_room_scoped_study();

drop trigger if exists enforce_study_room_resource_study_scope on public.study_room_resources;
create trigger enforce_study_room_resource_study_scope
before insert or update of room_id, study_id on public.study_room_resources
for each row execute function public.enforce_study_room_scoped_study();

create or replace function public.enforce_study_room_bookmark_scope()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  target_room_id uuid;
begin
  if new.note_id is not null then
    select room_id into target_room_id from public.study_room_notes where id = new.note_id;
  elsif new.thread_id is not null then
    select room_id into target_room_id from public.study_room_discussion_threads where id = new.thread_id;
  end if;

  if target_room_id is null or target_room_id <> new.room_id then
    raise exception 'Bookmark target does not belong to this Study Room'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_study_room_bookmark_scope on public.study_room_bookmarks;
create trigger enforce_study_room_bookmark_scope
before insert or update of room_id, note_id, thread_id on public.study_room_bookmarks
for each row execute function public.enforce_study_room_bookmark_scope();

create or replace function public.enforce_study_room_report_scope()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  target_room_id uuid;
begin
  if new.note_id is not null then
    select room_id into target_room_id from public.study_room_notes where id = new.note_id;
  elsif new.thread_id is not null then
    select room_id into target_room_id from public.study_room_discussion_threads where id = new.thread_id;
  elsif new.reply_id is not null then
    select study_room_discussion_threads.room_id
    into target_room_id
    from public.study_room_discussion_replies
    join public.study_room_discussion_threads
      on study_room_discussion_threads.id = study_room_discussion_replies.thread_id
    where study_room_discussion_replies.id = new.reply_id;
  elsif new.prayer_request_id is not null then
    select room_id into target_room_id from public.study_room_prayer_requests where id = new.prayer_request_id;
  elsif new.resource_id is not null then
    select room_id into target_room_id from public.study_room_resources where id = new.resource_id;
  end if;

  if target_room_id is null or target_room_id <> new.room_id then
    raise exception 'Report target does not belong to this Study Room'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_study_room_report_scope on public.study_room_reports;
create trigger enforce_study_room_report_scope
before insert or update of room_id, note_id, thread_id, reply_id, prayer_request_id, resource_id on public.study_room_reports
for each row execute function public.enforce_study_room_report_scope();

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

create or replace function public.study_room_role(target_room_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select study_room_members.role
    from public.study_room_members
    where study_room_members.room_id = target_room_id
      and study_room_members.profile_id = public.current_profile_id()
    limit 1
  ), null);
$$;

create or replace function public.is_study_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.study_room_members
    where study_room_members.room_id = target_room_id
      and study_room_members.profile_id = public.current_profile_id()
  );
$$;

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
    )
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

create or replace function public.can_moderate_study_room(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_engineer()
    or public.study_room_role(target_room_id) in ('owner', 'leader', 'moderator');
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

create or replace function public.can_access_study_room_study(target_study_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.study_room_studies
    where study_room_studies.id = target_study_id
      and public.can_read_study_room(study_room_studies.room_id)
      and (
        study_room_studies.status <> 'draft'
        or public.can_lead_study_room(study_room_studies.room_id)
      )
  );
$$;

create or replace function public.can_read_study_room_thread(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.study_room_discussion_threads
    where study_room_discussion_threads.id = target_thread_id
      and public.can_read_study_room(study_room_discussion_threads.room_id)
  );
$$;

grant execute on function public.study_room_role(uuid) to authenticated;
grant execute on function public.is_study_room_member(uuid) to authenticated;
grant execute on function public.can_read_study_room(uuid) to anon, authenticated;
grant execute on function public.can_lead_study_room(uuid) to authenticated;
grant execute on function public.can_moderate_study_room(uuid) to authenticated;
grant execute on function public.can_manage_study_room(uuid) to authenticated;
grant execute on function public.can_access_study_room_study(uuid) to authenticated;
grant execute on function public.can_read_study_room_thread(uuid) to authenticated;

alter table public.study_rooms enable row level security;
alter table public.study_room_members enable row level security;
alter table public.study_room_join_requests enable row level security;
alter table public.study_room_invitations enable row level security;
alter table public.study_room_studies enable row level security;
alter table public.study_room_study_progress enable row level security;
alter table public.study_room_notes enable row level security;
alter table public.study_room_discussion_threads enable row level security;
alter table public.study_room_discussion_replies enable row level security;
alter table public.study_room_prayer_requests enable row level security;
alter table public.study_room_prayer_support enable row level security;
alter table public.study_room_resources enable row level security;
alter table public.study_room_bookmarks enable row level security;
alter table public.study_room_reports enable row level security;

drop policy if exists "Public can discover public study rooms" on public.study_rooms;
create policy "Public can discover public study rooms"
on public.study_rooms for select
to anon, authenticated
using (visibility = 'public' and status <> 'archived');

drop policy if exists "Accessible study rooms are readable" on public.study_rooms;
create policy "Accessible study rooms are readable"
on public.study_rooms for select
to authenticated
using (public.can_read_study_room(id));

drop policy if exists "Authenticated users can create study rooms" on public.study_rooms;
create policy "Authenticated users can create study rooms"
on public.study_rooms for insert
to authenticated
with check (
  public.is_not_banned()
  and owner_profile_id = public.current_profile_id()
);

drop policy if exists "Owners and platform can update study rooms" on public.study_rooms;
create policy "Owners and platform can update study rooms"
on public.study_rooms for update
to authenticated
using (public.can_manage_study_room(id))
with check (public.can_manage_study_room(id));

drop policy if exists "Members can read study room memberships" on public.study_room_members;
create policy "Members can read study room memberships"
on public.study_room_members for select
to authenticated
using (public.can_read_study_room(room_id));

drop policy if exists "Members can leave study rooms" on public.study_room_members;
create policy "Members can leave study rooms"
on public.study_room_members for delete
to authenticated
using (profile_id = public.current_profile_id() and role <> 'owner');

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

drop policy if exists "Room owners can manage study room memberships" on public.study_room_members;
create policy "Room owners can manage study room memberships"
on public.study_room_members for all
to authenticated
using (public.can_manage_study_room(room_id))
with check (public.can_manage_study_room(room_id));

drop policy if exists "Users can read own study room join requests" on public.study_room_join_requests;
create policy "Users can read own study room join requests"
on public.study_room_join_requests for select
to authenticated
using (profile_id = public.current_profile_id() or public.can_lead_study_room(room_id));

drop policy if exists "Users can request study room access" on public.study_room_join_requests;
create policy "Users can request study room access"
on public.study_room_join_requests for insert
to authenticated
with check (
  public.is_not_banned()
  and profile_id = public.current_profile_id()
  and status = 'pending'
  and exists (
    select 1
    from public.study_rooms
    where study_rooms.id = study_room_join_requests.room_id
      and study_rooms.membership_mode = 'request_to_join'
      and study_rooms.status = 'active'
      and study_rooms.visibility in ('public', 'unlisted', 'private')
  )
);

drop policy if exists "Room leaders can review join requests" on public.study_room_join_requests;
create policy "Room leaders can review join requests"
on public.study_room_join_requests for update
to authenticated
using (public.can_lead_study_room(room_id))
with check (public.can_lead_study_room(room_id));

drop policy if exists "Users can read own study room invitations" on public.study_room_invitations;
create policy "Users can read own study room invitations"
on public.study_room_invitations for select
to authenticated
using (invited_profile_id = public.current_profile_id() or public.can_lead_study_room(room_id));

drop policy if exists "Room leaders can create study room invitations" on public.study_room_invitations;
create policy "Room leaders can create study room invitations"
on public.study_room_invitations for insert
to authenticated
with check (
  public.is_not_banned()
  and public.can_lead_study_room(room_id)
  and status = 'pending'
);

drop policy if exists "Invitees and leaders can update study room invitations" on public.study_room_invitations;
create policy "Invitees and leaders can update study room invitations"
on public.study_room_invitations for update
to authenticated
using (invited_profile_id = public.current_profile_id() or public.can_lead_study_room(room_id))
with check (invited_profile_id = public.current_profile_id() or public.can_lead_study_room(room_id));

drop policy if exists "Accessible studies are readable" on public.study_room_studies;
create policy "Accessible studies are readable"
on public.study_room_studies for select
to authenticated
using (public.can_access_study_room_study(id));

drop policy if exists "Room leaders can create studies" on public.study_room_studies;
create policy "Room leaders can create studies"
on public.study_room_studies for insert
to authenticated
with check (
  public.is_not_banned()
  and public.can_lead_study_room(room_id)
);

drop policy if exists "Room leaders can update studies" on public.study_room_studies;
create policy "Room leaders can update studies"
on public.study_room_studies for update
to authenticated
using (public.can_lead_study_room(room_id))
with check (public.can_lead_study_room(room_id));

drop policy if exists "Members can read own study progress and leaders can read all progress" on public.study_room_study_progress;
create policy "Members can read own study progress and leaders can read all progress"
on public.study_room_study_progress for select
to authenticated
using (
  profile_id = public.current_profile_id()
  or exists (
    select 1
    from public.study_room_studies
    where study_room_studies.id = study_room_study_progress.study_id
      and public.can_lead_study_room(study_room_studies.room_id)
  )
);

drop policy if exists "Members can manage own study progress" on public.study_room_study_progress;
create policy "Members can manage own study progress"
on public.study_room_study_progress for all
to authenticated
using (profile_id = public.current_profile_id())
with check (
  public.is_not_banned()
  and profile_id = public.current_profile_id()
  and public.can_access_study_room_study(study_id)
);

drop policy if exists "Members can read study room notes" on public.study_room_notes;
create policy "Members can read study room notes"
on public.study_room_notes for select
to authenticated
using (public.can_read_study_room(room_id));

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

drop policy if exists "Members can read study room discussion threads" on public.study_room_discussion_threads;
create policy "Members can read study room discussion threads"
on public.study_room_discussion_threads for select
to authenticated
using (public.can_read_study_room(room_id));

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

drop policy if exists "Members can read study room discussion replies" on public.study_room_discussion_replies;
create policy "Members can read study room discussion replies"
on public.study_room_discussion_replies for select
to authenticated
using (public.can_read_study_room_thread(thread_id));

drop policy if exists "Members can create study room discussion replies" on public.study_room_discussion_replies;
create policy "Members can create study room discussion replies"
on public.study_room_discussion_replies for insert
to authenticated
with check (
  public.is_not_banned()
  and author_user_id = auth.uid()
  and public.can_read_study_room_thread(thread_id)
  and exists (
    select 1
    from public.study_room_discussion_threads
    where study_room_discussion_threads.id = study_room_discussion_replies.thread_id
      and study_room_discussion_threads.deleted_at is null
      and study_room_discussion_threads.is_locked = false
  )
);

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

drop policy if exists "Members can read study room prayer requests" on public.study_room_prayer_requests;
create policy "Members can read study room prayer requests"
on public.study_room_prayer_requests for select
to authenticated
using (public.can_read_study_room(room_id));

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

drop policy if exists "Members can read study room prayer support" on public.study_room_prayer_support;
create policy "Members can read study room prayer support"
on public.study_room_prayer_support for select
to authenticated
using (
  exists (
    select 1
    from public.study_room_prayer_requests
    where study_room_prayer_requests.id = study_room_prayer_support.prayer_request_id
      and public.can_read_study_room(study_room_prayer_requests.room_id)
  )
);

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

drop policy if exists "Members can read study room resources" on public.study_room_resources;
create policy "Members can read study room resources"
on public.study_room_resources for select
to authenticated
using (public.can_read_study_room(room_id));

drop policy if exists "Room leaders can create study room resources" on public.study_room_resources;
create policy "Room leaders can create study room resources"
on public.study_room_resources for insert
to authenticated
with check (
  public.is_not_banned()
  and public.can_lead_study_room(room_id)
);

drop policy if exists "Room leaders can update study room resources" on public.study_room_resources;
create policy "Room leaders can update study room resources"
on public.study_room_resources for update
to authenticated
using (public.can_lead_study_room(room_id))
with check (public.can_lead_study_room(room_id));

drop policy if exists "Users can read own study room bookmarks" on public.study_room_bookmarks;
create policy "Users can read own study room bookmarks"
on public.study_room_bookmarks for select
to authenticated
using (profile_id = public.current_profile_id());

drop policy if exists "Users can manage own study room bookmarks" on public.study_room_bookmarks;
create policy "Users can manage own study room bookmarks"
on public.study_room_bookmarks for all
to authenticated
using (profile_id = public.current_profile_id())
with check (
  public.is_not_banned()
  and profile_id = public.current_profile_id()
  and public.can_read_study_room(room_id)
);

drop policy if exists "Members can create study room reports" on public.study_room_reports;
create policy "Members can create study room reports"
on public.study_room_reports for insert
to authenticated
with check (
  public.is_not_banned()
  and
  reporter_user_id = auth.uid()
  and public.can_read_study_room(room_id)
);

drop policy if exists "Users can read own study room reports" on public.study_room_reports;
create policy "Users can read own study room reports"
on public.study_room_reports for select
to authenticated
using (reporter_user_id = auth.uid());

drop policy if exists "Platform engineers can manage study room reports" on public.study_room_reports;
create policy "Platform engineers can manage study room reports"
on public.study_room_reports for all
to authenticated
using (public.is_platform_engineer())
with check (public.is_platform_engineer());

create or replace function public.prepare_study_rooms_for_account_deletion(
  target_user_id uuid,
  target_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
  affected_rooms integer := 0;
  room_record record;
  next_owner_profile_id uuid;
  result jsonb := '{}'::jsonb;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  delete from public.study_room_bookmarks
  where profile_id = target_profile_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_bookmarks', affected);

  delete from public.study_room_prayer_support
  where profile_id = target_profile_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_prayer_support', affected);

  delete from public.study_room_study_progress
  where profile_id = target_profile_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_study_progress', affected);

  delete from public.study_room_join_requests
  where profile_id = target_profile_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_join_requests', affected);

  delete from public.study_room_invitations
  where invited_profile_id = target_profile_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_invitations', affected);

  update public.study_room_invitations
  set invited_by_profile_id = null
  where invited_by_profile_id = target_profile_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_invitations_inviter_scrubbed', affected);

  delete from public.study_room_reports
  where reporter_user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_reports', affected);

  update public.study_room_reports
  set reviewed_by_profile_id = null
  where reviewed_by_profile_id = target_profile_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_reports_reviewer_scrubbed', affected);

  update public.study_room_notes
  set author_user_id = null,
      title = 'Deleted note',
      body = 'Deleted note',
      deleted_at = coalesce(deleted_at, now())
  where author_user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_notes_scrubbed', affected);

  update public.study_room_discussion_replies
  set author_user_id = null,
      body = 'Deleted reply',
      deleted_at = coalesce(deleted_at, now())
  where author_user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_discussion_replies_scrubbed', affected);

  update public.study_room_discussion_threads
  set author_user_id = null,
      title = 'Deleted discussion',
      body = 'Deleted discussion',
      deleted_at = coalesce(deleted_at, now())
  where author_user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_discussion_threads_scrubbed', affected);

  update public.study_room_prayer_requests
  set author_user_id = null,
      title = 'Deleted prayer request',
      body = 'Deleted prayer request',
      answered_update = null,
      status = case when status = 'answered' then status else 'removed' end,
      deleted_at = coalesce(deleted_at, now())
  where author_user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_prayer_requests_scrubbed', affected);

  update public.study_room_studies
  set created_by_profile_id = null
  where created_by_profile_id = target_profile_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_studies_creator_scrubbed', affected);

  update public.study_room_resources
  set created_by_profile_id = null
  where created_by_profile_id = target_profile_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('study_room_resources_creator_scrubbed', affected);

  if target_profile_id is not null then
    for room_record in
      select id
      from public.study_rooms
      where owner_profile_id = target_profile_id
    loop
      select profile_id
      into next_owner_profile_id
      from public.study_room_members
      where room_id = room_record.id
        and profile_id <> target_profile_id
        and role in ('owner', 'leader')
      order by case role when 'owner' then 0 when 'leader' then 1 else 2 end, created_at
      limit 1;

      if next_owner_profile_id is not null then
        update public.study_room_members
        set role = 'owner'
        where room_id = room_record.id
          and profile_id = next_owner_profile_id;

        update public.study_rooms
        set owner_profile_id = next_owner_profile_id
        where id = room_record.id;
      else
        update public.study_rooms
        set owner_profile_id = null,
            status = 'archived'
        where id = room_record.id;
      end if;

      affected_rooms := affected_rooms + 1;
    end loop;

    delete from public.study_room_members
    where profile_id = target_profile_id;
    get diagnostics affected = row_count;
    result := result || jsonb_build_object('study_room_members', affected);
  else
    result := result || jsonb_build_object('study_room_members', 0);
  end if;

  result := result || jsonb_build_object('study_rooms_transferred_or_archived', affected_rooms);

  return result;
end;
$$;

revoke execute on function public.prepare_study_rooms_for_account_deletion(uuid, uuid) from public;
revoke execute on function public.prepare_study_rooms_for_account_deletion(uuid, uuid) from anon;
revoke execute on function public.prepare_study_rooms_for_account_deletion(uuid, uuid) from authenticated;
grant execute on function public.prepare_study_rooms_for_account_deletion(uuid, uuid) to service_role;

create or replace function public.delete_user_account_data(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile_id uuid;
  affected integer;
  study_room_result jsonb := '{}'::jsonb;
  result jsonb := '{}'::jsonb;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  select id
  into target_profile_id
  from public.profiles
  where user_id = target_user_id;

  study_room_result := public.prepare_study_rooms_for_account_deletion(target_user_id, target_profile_id);
  result := result || jsonb_build_object('study_rooms', study_room_result);

  delete from public.message_attachments
  where uploader_id = target_user_id
     or message_id in (
       select id from public.direct_messages where sender_id = target_user_id
     );
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('message_attachments', affected);

  delete from public.message_reactions where user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('message_reactions', affected);

  update public.direct_messages
  set sender_id = null,
      body = 'Message deleted',
      deleted_at = coalesce(deleted_at, now())
  where sender_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('direct_messages_scrubbed', affected);

  delete from public.conversation_participants where user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('conversation_participants', affected);

  delete from public.conversations
  where not exists (
    select 1
    from public.conversation_participants
    where conversation_participants.conversation_id = conversations.id
  );
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('empty_conversations', affected);

  delete from public.message_reports where reporter_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('message_reports', affected);

  delete from public.user_blocks
  where blocker_id = target_user_id
     or blocked_user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('user_blocks', affected);

  delete from public.notifications where user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('notifications', affected);

  update public.notifications
  set actor_user_id = null
  where actor_user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('notifications_actor_scrubbed', affected);

  delete from public.event_rsvps where user_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('event_rsvps', affected);

  delete from public.giving_intents where giver_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('giving_intents', affected);

  delete from public.giving_campaigns where created_by = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('giving_campaigns', affected);

  delete from public.community_post_reactions where author_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('community_post_reactions', affected);

  update public.community_post_comments
  set author_id = null,
      body = 'Deleted comment',
      deleted_at = coalesce(deleted_at, now())
  where author_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('community_post_comments_scrubbed', affected);

  update public.community_posts
  set author_id = null,
      title = 'Deleted post',
      body = null,
      media_url = null,
      media_kind = null,
      storage_path = null,
      file_name = null,
      mime_type = null,
      size_bytes = null,
      is_published = false,
      deleted_at = coalesce(deleted_at, now())
  where author_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('community_posts_scrubbed', affected);

  delete from public.discussion_reports where reporter_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('discussion_reports', affected);

  update public.discussion_replies
  set author_id = null,
      body = 'Deleted reply',
      deleted_at = coalesce(deleted_at, now())
  where author_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('discussion_replies_scrubbed', affected);

  update public.discussion_threads
  set author_id = null,
      title = 'Deleted discussion',
      body = 'Deleted discussion',
      deleted_at = coalesce(deleted_at, now())
  where author_id = target_user_id;
  get diagnostics affected = row_count;
  result := result || jsonb_build_object('discussion_threads_scrubbed', affected);

  if target_profile_id is not null then
    delete from public.prayer_requests where profile_id = target_profile_id;
    get diagnostics affected = row_count;
    result := result || jsonb_build_object('prayer_requests', affected);

    delete from public.profiles where id = target_profile_id;
    get diagnostics affected = row_count;
    result := result || jsonb_build_object('profiles', affected);
  else
    result := result || jsonb_build_object('prayer_requests', 0, 'profiles', 0);
  end if;

  return result;
end;
$$;

revoke execute on function public.delete_user_account_data(uuid) from public;
revoke execute on function public.delete_user_account_data(uuid) from anon;
revoke execute on function public.delete_user_account_data(uuid) from authenticated;
grant execute on function public.delete_user_account_data(uuid) to service_role;
